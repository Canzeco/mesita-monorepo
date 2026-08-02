// Supabase Edge Function — consumer-web-claim-instagram (natural caller)
//
// Authenticated. The Instagram "door" into Magnetic: a consumer with at least
// the Magnetic follower threshold (5,000) gets the Magnetic class instantly,
// origin 'instagram'. Below the threshold, an existing instagram-origin
// Magnetic is dropped back to Standard. Premium is now paid-only (subscription);
// subscription / invitation classes are never touched here (origin precedence).
//
// There is NO per-visit "post a story" requirement: follower count alone sets
// (and keeps) the class, and the Magnetic rung pays on every bill unconditionally
// (resolveTicketRate, _shared/rewards-config.ts). The ticket story-verification
// flow feeds the SEPARATE, optional `story` rung any class can take.
//
// Body: { followers: number, handle?: string }
// Response: { ok: true, tier: "standard"|"magnetic", followers: number,
//             handle: string | null }
//
// `handle` (when sent) is normalized (leading @ stripped, lowercased) and
// persisted to consumers.instagram_handle so the profile hero/settings can
// show @handle instead of just the follower count (MESITA-74).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { getTierConfig } from "../_shared/membership.ts";

type Body = { followers?: number; handle?: string };

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

  const magnetic = await getTierConfig(admin, "magnetic");
  const threshold = magnetic?.follower_threshold ?? 5000;
  const qualifies = followers >= threshold;

  // Always persist the latest follower count (and handle when sent).
  const patch: Record<string, unknown> = {
    consumer_instagram_followers_count: followers,
  };
  if (handle !== null) patch.instagram_handle = handle;

  if (qualifies) {
    patch.class_key = "magnetic";
    patch.class_origin = "instagram";
    patch.class_granted_at = new Date().toISOString();
    patch.class_expires_at = null;
    const { error } = await admin.from("consumers").update(patch).eq("id", consumerId);
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, tier: "magnetic", followers, handle });
  }

  // Below threshold: record followers; drop ONLY an instagram-origin Magnetic.
  const { error: e1 } = await admin
    .from("consumers")
    .update(patch)
    .eq("id", consumerId);
  if (e1) return json({ ok: false, error: e1.message }, 500);

  await admin
    .from("consumers")
    .update({ class_key: "standard", class_origin: "default", class_expires_at: null })
    .eq("id", consumerId)
    .eq("class_origin", "instagram");

  return json({ ok: true, tier: "standard", followers, handle });
});
