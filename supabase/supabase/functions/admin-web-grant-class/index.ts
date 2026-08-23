// Supabase Edge Function — admin-web-grant-class
//
// Naming: caller-verb-words. Caller = admin, verb = grant, words = class.
//
// The Aura door (segments v6): Aura is the invite-only presence class, and for
// launch the only granter is the admin console. Grant/revoke write the
// INVITATION DOOR FACT (consumers.invitation_class_key /
// invitation_granted_at) and then let the shared recompute
// (_shared/class-doors.ts, MESITA-972) settle the slot from every open door —
// a revoked Aura member with a live subscription lands premium/'subscription',
// one with reach lands influencer/'instagram', else standard/'default'. The
// invitation never cancels the other doors: a paying member granted Aura
// keeps their subscription running underneath.
//
// Generic on purpose: `classKey` accepts any invitation-grantable class row
// (today just 'aura'; a future tier INSERT works unchanged). Granting never
// needs a rank guard — an explicit admin grant is the highest-intent write
// (and the recompute keeps the slot honest anyway).
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
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { recomputeConsumerClass } from "../_shared/class-doors.ts";
import { writeConsumer } from "../_shared/consumer-doc.ts";
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
  instagram_followers_count: number | null;
  class_key: string | null;
  class_origin: string | null;
  class_granted_at: string | null;
  invitation_class_key: string | null;
  invitation_granted_at: string | null;
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
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

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

    const grant = await writeConsumer(admin, {
      mode: "update",
      id: consumerId,
      patch: {
        invitation_class_key: classKey,
        invitation_granted_at: new Date().toISOString(),
      },
    });
    if (!grant.ok) {
      return json({ ok: false, error: `grant: ${grant.error}` }, 500);
    }

    return finishWithRecompute(admin, consumerId, consumer);
  }

  // ── Revoke ───────────────────────────────────────────────────────────────
  // Only the invitation DOOR is revocable here — clearing the fact and
  // recomputing lands the best remaining door (subscription → premium,
  // reach → influencer, else standard) via the shared precedence.
  if (!consumer.invitation_class_key) {
    return json(
      {
        ok: false,
        error: "Nothing to revoke: no invitation-granted class on this consumer.",
      },
      409,
    );
  }

  const revoke = await writeConsumer(admin, {
    mode: "update",
    id: consumerId,
    patch: { invitation_class_key: null, invitation_granted_at: null },
  });
  if (!revoke.ok) {
    return json({ ok: false, error: `revoke: ${revoke.error}` }, 500);
  }

  return finishWithRecompute(admin, consumerId, consumer);
});

// Settle the slot from every open door, then re-read the summary row so the
// roster renders the post-recompute state without a second round trip.
async function finishWithRecompute(
  admin: SupabaseClient,
  consumerId: string,
  fallbackRow: ConsumerRow,
): Promise<Response> {
  let effective;
  try {
    effective = await recomputeConsumerClass(admin, consumerId);
  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
  const reread = await admin
    .from("consumers")
    .select(CONSUMER_SUMMARY_COLUMNS)
    .eq("id", consumerId)
    .maybeSingle();
  return json({
    ok: true,
    consumerId,
    classKey: effective.classKey,
    origin: effective.origin,
    consumer: toConsumerSummary(reread.data ?? fallbackRow),
  });
}
