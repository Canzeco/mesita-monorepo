// Supabase Edge Function — consumer-web-list-reservations (natural caller)
//
// Authenticated read of the caller's reservations. Returns booking
// metadata joined with the place summary — NO discount /
// money fields, because the entity split's contract is that the
// reservation card never carries financial info. The (optional)
// linked coupon is exposed by id only so the client can cross-
// reference the coupons list, but the rates / cap live on the
// coupon row, never here.
//
// Defaults to upcoming + recently completed; pass `scope: "past"` for
// archived bookings.
//
// Deploy: supabase functions deploy consumer-web-list-reservations

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { clampIntRange, corsPreflight, json, readJsonOr } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// How long a slot stays in Upcoming after its time — you're still at the
// table. Mirrored by consumer-web-{cancel,update}-reservation.
const PASSED_GRACE_MS = 4 * 3600_000;

// Everything that ended without a live booking. `passed` is NOT here: it's
// derived (confirmed + slot behind us), never stored — no cron to keep honest.
const TERMINAL_STATUSES = [
  "declined",
  "no_show",
  "cancelled",
  "unreachable",
  "unresolved",
] as const;

type Scope = "upcoming" | "past" | "all";
type Body = { limit?: number; scope?: Scope };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "GET" && req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  let limit = DEFAULT_LIMIT;
  let scope: Scope = "upcoming";
  if (req.method === "POST") {
    const body = await readJsonOr<Body>(req, {});
    if (typeof body.limit === "number") {
      limit = clampIntRange(body.limit, 1, MAX_LIMIT);
    }
    if (body.scope === "past" || body.scope === "all") scope = body.scope;
  }

  const admin = adminClient(envRes.env);

  // NO place embed — reservations→places is a two-hop FK chain and PostgREST
  // rejects it ("no relationship … in the schema cache"). attachPlaces does the
  // lookup; see _shared/reservation-places.ts.
  let q = admin
    .from("reservations")
    .select(
      // attempts_state / call_attempts let the app separate `created` (no dial
      // yet) from `booking` (agent working it) — see the lifecycle in the
      // consumer adapter.
      "id, reserved_at, party_size, status, reference_code, notes, confirmed_at, completed_at, cancelled_at, coupon_id, created_at, project_id, attempts_state, call_attempts",
    )
    .eq("consumer_id", consumerId)
    // Operator test tickets (is_test) reference real consumers — never surface
    // them in the guest's own list.
    .eq("is_test", false)
    .order("reserved_at", { ascending: scope === "past" ? false : true })
    .limit(limit);

  // Scope is DATE-AWARE, not status-only: a confirmed table whose slot came
  // and went is "passed" and belongs in History — it used to sit in Upcoming
  // forever. The grace keeps tonight's booking in Upcoming while you're at it.
  const passedCutoff = new Date(Date.now() - PASSED_GRACE_MS).toISOString();
  if (scope === "upcoming") {
    q = q.in("status", ["pending", "confirmed"]).gte("reserved_at", passedCutoff);
  } else if (scope === "past") {
    // Terminal outcomes at any date, OR a live ticket whose slot has passed.
    q = q.or(
      `status.in.(${TERMINAL_STATUSES.join(",")}),` +
        `and(status.in.(pending,confirmed),reserved_at.lt.${passedCutoff})`,
    );
  }

  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message }, 500);
  const reservations = await attachPlaces(admin, data ?? []);
  return json({ ok: true, reservations });
});
