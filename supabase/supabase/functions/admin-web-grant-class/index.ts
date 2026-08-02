// Supabase Edge Function — admin-web-grant-class
//
// Naming: caller-verb-words. Caller = admin, verb = grant, words = class.
//
// The Aura door (segments v6): Aura is the invite-only presence class, and for
// launch the only granter is the admin console. Grant writes
// class_key='aura' / class_origin='invitation'; revoke recomputes the best
// remaining door from real state — a live subscription keeps the consumer at
// premium/'subscription', a persisted follower count at or above the
// Influencer threshold lands influencer/'instagram', else standard/'default'.
//
// Generic on purpose: `classKey` accepts any invitation-grantable class row
// (today just 'aura'; a future tier INSERT works unchanged). Granting never
// needs a rank guard — an explicit admin grant is the highest-intent write.
//
// Body: { consumerId: string, classKey: "aura" | null }  (null = revoke)
// Response: { ok: true, consumerId, classKey, origin }
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";

type Body = { consumerId?: string; classKey?: string | null };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const consumerId = (bodyRes.body.consumerId ?? "").toString().trim();
  const classKey = bodyRes.body.classKey ?? null;
  if (!consumerId) {
    return json({ ok: false, error: "consumerId is required" }, 400);
  }

  const consumerRes = await admin
    .from("consumers")
    .select("id, class_key, class_origin, consumer_instagram_followers_count")
    .eq("id", consumerId)
    .maybeSingle();
  if (consumerRes.error) {
    return json({ ok: false, error: `consumer: ${consumerRes.error.message}` }, 500);
  }
  if (!consumerRes.data) {
    return json({ ok: false, error: "Consumer not found" }, 404);
  }
  const consumer = consumerRes.data;

  // ── Grant ────────────────────────────────────────────────────────────────
  if (classKey !== null) {
    const classRow = await admin
      .from("classes")
      .select("key")
      .eq("key", classKey)
      .maybeSingle();
    if (classRow.error) {
      return json({ ok: false, error: `classes: ${classRow.error.message}` }, 500);
    }
    if (!classRow.data) {
      return json({ ok: false, error: `Unknown class: ${classKey}` }, 400);
    }

    const grant = await admin
      .from("consumers")
      .update({
        class_key: classKey,
        class_origin: "invitation",
        class_granted_at: new Date().toISOString(),
        class_expires_at: null,
      })
      .eq("id", consumerId);
    if (grant.error) {
      return json({ ok: false, error: `grant: ${grant.error.message}` }, 500);
    }
    return json({ ok: true, consumerId, classKey, origin: "invitation" });
  }

  // ── Revoke ───────────────────────────────────────────────────────────────
  // Only an invitation-origin class is revocable here; recompute the best
  // remaining door from real state (mirrors claim-instagram's fallback).
  if (consumer.class_origin !== "invitation") {
    return json(
      {
        ok: false,
        error: `Nothing to revoke: class origin is '${consumer.class_origin}', not 'invitation'.`,
      },
      409,
    );
  }

  // Both remaining doors are evaluated, then the HIGHEST-RANKED one wins —
  // the ladder is standard(0) < premium(1) < influencer(2) < aura(3), so a
  // consumer who both subscribes and has reach must land on the better class.
  // (Checking the subscription first would strand an Influencer-qualified
  // consumer on Premium — and the next claim-instagram call, whose rank guard
  // permits the upgrade, would immediately overturn it.)
  const sub = await admin
    .from("consumer_subscriptions")
    .select("current_period_end")
    .eq("consumer_id", consumerId)
    .in("status", ["active", "past_due"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Reach door: highest classes row whose follower_threshold the persisted
  // count clears (data-driven, same rule as claim-instagram).
  const followers = consumer.consumer_instagram_followers_count ?? 0;
  const tiers = await admin
    .from("classes")
    .select("key, rank, follower_threshold")
    .not("follower_threshold", "is", null)
    .order("rank", { ascending: false });
  const won = (tiers.data ?? []).find(
    (t) => t.follower_threshold != null && followers >= t.follower_threshold,
  );

  const premiumRow = await admin
    .from("classes")
    .select("rank")
    .eq("key", "premium")
    .maybeSingle();
  const premiumRank = premiumRow.data?.rank ?? 1;

  let fallback: {
    class_key: string;
    class_origin: string;
    class_expires_at: string | null;
  };
  if (won && (!sub.data || won.rank >= premiumRank)) {
    fallback = {
      class_key: won.key,
      class_origin: "instagram",
      class_expires_at: null,
    };
  } else if (sub.data) {
    fallback = {
      class_key: "premium",
      class_origin: "subscription",
      class_expires_at: sub.data.current_period_end ?? null,
    };
  } else {
    fallback = {
      class_key: "standard",
      class_origin: "default",
      class_expires_at: null,
    };
  }

  const revoke = await admin
    .from("consumers")
    .update(fallback)
    .eq("id", consumerId)
    .eq("class_origin", "invitation");
  if (revoke.error) {
    return json({ ok: false, error: `revoke: ${revoke.error.message}` }, 500);
  }
  return json({
    ok: true,
    consumerId,
    classKey: fallback.class_key,
    origin: fallback.class_origin,
  });
});
