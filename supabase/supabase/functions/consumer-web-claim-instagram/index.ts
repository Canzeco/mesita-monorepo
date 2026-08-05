// Supabase Edge Function — consumer-web-claim-instagram (natural caller)
//
// Authenticated. The Instagram "door" into the Influencer class (segments v6):
// a consumer at or above the Influencer follower threshold (classes row,
// 2,000) gets the Influencer class instantly, origin 'instagram'. The winning
// tier is picked DATA-DRIVEN — the highest-ranked classes row whose
// follower_threshold fits — so future reach tiers are INSERTs, not code.
//
// Precedence (rank never silently downgrades):
//   • A qualifying claim writes the won class only when the consumer's current
//     class is instagram-origin (re-level up or down within the door) or the
//     won rank ≥ the current rank. An invitation-granted Aura or any
//     higher-ranked class is never clobbered by a follower count.
//   • Below every threshold, ONLY an instagram-origin class is dropped — and
//     it falls back to the best remaining door: a live subscription keeps the
//     consumer at premium/'subscription' (they are paying), else
//     standard/'default'.
//
// Story access follows the connected handle (MESITA-909), not the Influencer
// class: claiming Instagram (persisting `instagram_handle`) unlocks the Story
// action for any class; crossing the follower threshold separately grants
// the Influencer class and its class-step rate bump.
//
// Body: { followers: number, handle?: string }
// Response: { ok: true, tier: string, followers: number, handle: string | null }
//
// `handle` (when sent) is normalized (leading @ stripped, lowercased) and
// persisted to consumers.instagram_handle so the profile hero/settings can
// show @handle instead of just the follower count (MESITA-74).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";

type Body = { followers?: number; handle?: string };

type ClassRow = {
  key: string;
  rank: number;
  follower_threshold: number | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const followers = Math.trunc(Number(body.followers));
  if (!Number.isFinite(followers) || followers < 0) {
    return json({ ok: false, error: "followers must be a non-negative integer" }, 400);
  }

  let handle: string | null = null;
  if (body.handle !== undefined && body.handle !== null) {
    handle = String(body.handle).trim().replace(/^@/, "").toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(handle)) {
      return json({ ok: false, error: "handle must be a valid Instagram username" }, 400);
    }
  }

  const admin = adminClient(envRes.env);

  const classesRes = await admin
    .from("classes")
    .select("key, rank, follower_threshold")
    .order("rank", { ascending: false });
  if (classesRes.error) {
    return json({ ok: false, error: `classes: ${classesRes.error.message}` }, 500);
  }
  const classes = (classesRes.data ?? []) as ClassRow[];
  const rankOf = (key: string | null | undefined): number =>
    classes.find((c) => c.key === key)?.rank ?? 0;

  // Highest-ranked reach tier the follower count clears (rows are rank-desc).
  const won = classes.find(
    (c) => c.follower_threshold != null && followers >= c.follower_threshold,
  ) ?? null;

  const currentRes = await admin
    .from("consumers")
    .select("class_key, class_origin")
    .eq("id", consumerId)
    .maybeSingle();
  if (currentRes.error) {
    return json({ ok: false, error: `consumer: ${currentRes.error.message}` }, 500);
  }
  const current = {
    key: (currentRes.data?.class_key as string | null) ?? "standard",
    origin: (currentRes.data?.class_origin as string | null) ?? "default",
  };

  // Always persist the latest follower count (and handle when sent).
  const patch: Record<string, unknown> = {
    consumer_instagram_followers_count: followers,
  };
  if (handle !== null) patch.instagram_handle = handle;

  if (won && (current.origin === "instagram" || won.rank >= rankOf(current.key))) {
    patch.class_key = won.key;
    patch.class_origin = "instagram";
    patch.class_granted_at = new Date().toISOString();
    patch.class_expires_at = null;
    const { error } = await admin.from("consumers").update(patch).eq("id", consumerId);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, tier: won.key, followers, handle });
  }

  // No (or non-winning) reach: record followers; then drop ONLY an
  // instagram-origin class, falling back to the best remaining door.
  const { error: e1 } = await admin
    .from("consumers")
    .update(patch)
    .eq("id", consumerId);
  if (e1) return json({ ok: false, error: e1.message }, 500);

  let fellBackTo = current.origin === "instagram" ? "standard" : current.key;
  if (current.origin === "instagram") {
    const sub = await admin
      .from("consumer_subscriptions")
      .select("current_period_end")
      .eq("consumer_id", consumerId)
      .in("status", ["active", "past_due"])
      .order("current_period_end", { ascending: false })
      .limit(1)
      .maybeSingle();
    const fallback = sub.data
      ? {
          class_key: "premium",
          class_origin: "subscription",
          class_expires_at: sub.data.current_period_end ?? null,
        }
      : { class_key: "standard", class_origin: "default", class_expires_at: null };
    fellBackTo = fallback.class_key;
    await admin
      .from("consumers")
      .update(fallback)
      .eq("id", consumerId)
      .eq("class_origin", "instagram");

    // Re-verify liveness after the write. The subscription read above and this
    // write are not atomic: a Stripe lapse webhook landing between them would
    // no-op its own revoke (it is guarded on class_origin='subscription' while
    // ours is still 'instagram') and leave a free Premium that no later event
    // ever heals — canceled subscriptions emit nothing more, and
    // class_expires_at is display-only. Settle it here instead.
    if (sub.data) {
      const stillLive = await admin
        .from("consumer_subscriptions")
        .select("consumer_id", { count: "exact", head: true })
        .eq("consumer_id", consumerId)
        .in("status", ["active", "past_due"]);
      if ((stillLive.count ?? 0) === 0) {
        await admin
          .from("consumers")
          .update({
            class_key: "standard",
            class_origin: "default",
            class_expires_at: null,
          })
          .eq("id", consumerId)
          .eq("class_origin", "subscription");
        fellBackTo = "standard";
      }
    }
  }

  return json({ ok: true, tier: fellBackTo, followers, handle });
});
