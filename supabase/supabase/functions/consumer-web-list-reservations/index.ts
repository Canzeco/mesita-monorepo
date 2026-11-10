// Supabase Edge Function — consumer-web-list-reservations (product caller)
//
// Authenticated read of the caller's reservations. Returns booking
// metadata joined with the place summary — NO discount /
// money fields, because the entity split's contract is that the
// reservation card never carries financial info. The reservation has no
// discount surface at all: a reward comes from showing up, and the rates
// live on the visit ticket.
//
// Defaults to upcoming + recently completed; pass `scope: "past"` for
// archived bookings.
//
// Deploy: supabase functions deploy consumer-web-list-reservations

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { clampIntRange, corsPreflight, json, rejectUnlessMethods, readJsonOr, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { PASSED_GRACE_MS } from "../_shared/reservation-doc.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Everything that ended without a live booking. `passed` is NOT here: it's
// derived (confirmed + slot behind us), never stored — no cron to keep honest.
const TERMINAL_STATES = [
  "declined",
  "cancelled",
  "unreachable",
  "unresolved",
] as const;

type Scope = "upcoming" | "past" | "all";

type NamedRow = { guest_first_name: string | null; guest_last_name: string | null };

/** The name each table is under (MESITA-3609): what the guest typed on the
 *  Reserve form (MESITA-3607), else, on older tickets, the caller's profile
 *  name. One profile read, and only when some row needs it. A failed read
 *  leaves the nulls: a name is never worth failing the list. */
async function withGuestNames<T extends NamedRow>(
  admin: ReturnType<typeof adminClient>,
  consumerId: string,
  rows: T[],
): Promise<T[]> {
  const blank = (s: string | null) => !(s ?? "").trim();
  if (!rows.some((r) => blank(r.guest_first_name) && blank(r.guest_last_name))) return rows;
  const { data, error } = await admin
    .from("consumers")
    .select("first_name, last_name")
    .eq("id", consumerId)
    .maybeSingle();
  if (error) {
    console.error("[consumer-web-list-reservations] consumer name:", error.message);
    return rows;
  }
  if (!data) return rows;
  return rows.map((r) =>
    blank(r.guest_first_name) && blank(r.guest_last_name)
      ? { ...r, guest_first_name: data.first_name ?? null, guest_last_name: data.last_name ?? null }
      : r
  );
}
type Body = { limit?: number; scope?: Scope };

serveJson("consumer-web-list-reservations", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "GET", "POST");
  if (methodReject) return methodReject;

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
    .from("reservation_tickets")
    .select(
      // attempts_state / call_attempts let the app separate `created` (no dial
      // yet) from `booking` (agent working it) — see the lifecycle in the
      // consumer adapter.
      "id, reserved_at, party_size, state, reference_code, notes, confirmed_at, cancelled_at, created_at, place_id, attempts_state, next_attempt_at, call_attempts, consumer_notify, consumer_confirmed_at, alternatives, guest_first_name, guest_last_name",
    )
    .eq("consumer_id", consumerId)
    // Operator test tickets (is_test) reference real consumers — never surface
    // them in the guest's own list.
    .eq("is_test", false)
    .order("reserved_at", { ascending: scope === "past" ? false : true })
    .limit(limit);

  // Scope is DATE-AWARE, not state-only: a confirmed table whose slot came
  // and went is "passed" and belongs in History — it used to sit in Upcoming
  // forever. The grace keeps tonight's booking in Upcoming while you're at it.
  const passedCutoff = new Date(Date.now() - PASSED_GRACE_MS).toISOString();
  if (scope === "upcoming") {
    q = q.in("state", ["pending", "confirmed"]).gte("reserved_at", passedCutoff);
  } else if (scope === "past") {
    // Terminal outcomes at any date, OR a live ticket whose slot has passed.
    q = q.or(
      `state.in.(${TERMINAL_STATES.join(",")}),` +
        `and(state.in.(pending,confirmed),reserved_at.lt.${passedCutoff})`,
    );
  }

  const { data, error } = await q;
  if (error) return json({ ok: false, error: error.message }, 500);
  const rows = await withGuestNames(admin, consumerId, data ?? []);
  const reservations = await attachPlaces(admin, rows);
  return json({ ok: true, reservations });
});
