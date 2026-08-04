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
// The consumer is named either by `consumerId` (a uuid, the original contract)
// or by `lookup` — a free identifier the operator actually has at hand: uuid,
// 8-digit code, phone, @handle, or name. A lookup must land on EXACTLY one
// consumer; several matches come back as a 409 listing the candidates, because
// guessing which guest gets an invitation is not this function's call.
//
// Body: { consumerId?: string, lookup?: string, classKey: "aura" | null }
//       (classKey null = revoke; exactly one of consumerId / lookup)
// Response: { ok: true, consumerId, classKey, origin, consumer }
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
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  candidateLabel,
  classifyConsumerLookup,
  CONSUMER_SUMMARY_COLUMNS,
  describeLookup,
  phoneDigitsTail,
  safeOrFilterValue,
  toConsumerSummary,
} from "../_shared/consumer-lookup.ts";

type Body = {
  consumerId?: string;
  lookup?: string;
  classKey?: string | null;
};

/** The CONSUMER_SUMMARY_COLUMNS shape, as this untyped client returns it. */
type ConsumerRow = {
  id: string;
  code: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  instagram_handle: string | null;
  consumer_instagram_followers_count: number | null;
  class_key: string | null;
  class_origin: string | null;
  class_granted_at: string | null;
};

// Resolve whatever the operator typed to a single consumer row, or the exact
// response explaining why it couldn't be done.
async function resolveConsumer(
  admin: SupabaseClient,
  raw: string,
): Promise<{ ok: true; row: ConsumerRow } | { ok: false; response: Response }> {
  const lookup = classifyConsumerLookup(raw);
  if (!lookup) {
    return {
      ok: false,
      response: json(
        {
          ok: false,
          error:
            `Not a consumer identifier: "${raw}". Use a uuid, an 8-digit code, a phone, an @handle, or a name.`,
        },
        400,
      ),
    };
  }

  let query = admin.from("consumers").select(CONSUMER_SUMMARY_COLUMNS).limit(6);
  switch (lookup.kind) {
    case "id":
      query = query.eq("id", lookup.value);
      break;
    case "code":
      query = query.eq("code", lookup.value);
      break;
    case "phone":
      // Loose match on the national number — stored rows carry the country
      // prefix inconsistently enough that an equality check misses people.
      query = query.ilike("phone", `%${phoneDigitsTail(lookup.value)}`);
      break;
    case "handle":
      // `_` is legal in a handle AND a single-char wildcard in LIKE, so this
      // pattern over-matches by design; the exact compare below narrows it.
      query = query.ilike("instagram_handle", lookup.value);
      break;
    case "text": {
      const v = safeOrFilterValue(lookup.value);
      if (!v) {
        return {
          ok: false,
          response: json({ ok: false, error: "Empty search." }, 400),
        };
      }
      query = query.or(
        [
          `full_name.ilike.%${v}%`,
          `first_name.ilike.%${v}%`,
          `last_name.ilike.%${v}%`,
          `instagram_handle.ilike.%${v}%`,
        ].join(","),
      );
      break;
    }
  }

  const { data, error } = await query;
  if (error) {
    return {
      ok: false,
      response: json({ ok: false, error: `consumer: ${error.message}` }, 500),
    };
  }
  const matched = (data ?? []) as unknown as ConsumerRow[];
  const rows = lookup.kind === "handle"
    ? matched.filter(
      (r) => (r.instagram_handle ?? "").trim().toLowerCase() === lookup.value,
    )
    : matched;
  if (rows.length === 0) {
    return {
      ok: false,
      response: json(
        { ok: false, error: `No consumer matches ${describeLookup(lookup)}.` },
        404,
      ),
    };
  }
  if (rows.length > 1) {
    // The query is capped at 6, so a full page means "at least this many".
    const count = rows.length > 5 ? "More than 5 consumers" : `${rows.length} consumers`;
    const names = rows.slice(0, 5).map(candidateLabel).join(", ");
    return {
      ok: false,
      response: json(
        {
          ok: false,
          error:
            `${count} match ${describeLookup(lookup)} — ${names}. Narrow it down, or paste the id.`,
        },
        409,
      ),
    };
  }
  return { ok: true, row: rows[0] };
}

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
  const rawId = (bodyRes.body.consumerId ?? "").toString().trim();
  const rawLookup = (bodyRes.body.lookup ?? "").toString().trim();
  const classKey = bodyRes.body.classKey ?? null;
  if (!rawId && !rawLookup) {
    return json({ ok: false, error: "consumerId or lookup is required" }, 400);
  }

  // An explicit id wins over a lookup — a caller that has the uuid is not
  // asking to be searched for.
  const resolved = await resolveConsumer(admin, rawId || rawLookup);
  if (!resolved.ok) return resolved.response;
  const consumer = resolved.row;
  const consumerId = String(consumer.id);

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
      .eq("id", consumerId)
      .select(CONSUMER_SUMMARY_COLUMNS)
      .maybeSingle();
    if (grant.error) {
      return json({ ok: false, error: `grant: ${grant.error.message}` }, 500);
    }
    return json({
      ok: true,
      consumerId,
      classKey,
      origin: "invitation",
      // The row as written — the roster renders it without a refetch.
      consumer: toConsumerSummary(grant.data ?? consumer),
    });
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
    .eq("class_origin", "invitation")
    .select(CONSUMER_SUMMARY_COLUMNS)
    .maybeSingle();
  if (revoke.error) {
    return json({ ok: false, error: `revoke: ${revoke.error.message}` }, 500);
  }
  return json({
    ok: true,
    consumerId,
    classKey: fallback.class_key,
    origin: fallback.class_origin,
    consumer: toConsumerSummary(revoke.data ?? { ...consumer, ...fallback }),
  });
});
