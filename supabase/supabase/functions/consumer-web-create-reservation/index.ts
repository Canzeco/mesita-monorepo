// Supabase Edge Function — consumer-web-create-reservation (product caller)
//
// Authenticated. Creates a reservation row for the caller and hands it to
// the Reservationist, capped per guest per month (_shared/reservation-cap.ts).
//
// Body:
//   { project_id: uuid, reserved_at: iso8601, party_size: int, notes?: string,
//     consumer_notify?: "call" | "app",  // default "call" (MESITA-787)
//     request_id?: uuid,                  // one per Reserve request (MESITA-3619)
//     time_window_minutes?: 0|30|60,      // default 30 (MESITA-3957)
//     seating?: "any"|"inside"|"outside"|"bar",  // default any
//     confirm_notify?: "app"|"call" }  // default app (MESITA-4187)
//
// Response:
//   { ok: true, reservation: {…}, call_triggered, replayed? }
//   409 { code: "already_reserved", reservation_id } — a live ticket at this
//       place, at any time (one per place per guest, MESITA-3640)
//
// A RESERVATION ALWAYS MOVES (MESITA-3619, _shared/reservation-create.ts):
// the same request_id returns the ticket it already made; a second live
// live ticket at the same place is refused (MESITA-3640); and the ticket is born
// scheduled and due now, so the minute cron moves it if the immediate push
// below is lost. The engine decides WHEN the first call rings (MESITA-3626):
// now when the place is open, else at its opening time.
//
// Deploy: supabase functions deploy consumer-web-create-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireConsumerRequest } from "../_shared/request.ts";
import { refuseOutsideTestPlace } from "../_shared/test-guest.ts";
import { invokeInternalCaller } from "../_shared/internal.ts";
import { generateReservationCode } from "../_shared/reservation-code.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";
import {
  ALREADY_RESERVED_CODE,
  ALREADY_RESERVED_MESSAGE,
  type CreateGuardStore,
  type CreateTicket,
  guardCreate,
  readRequestId,
} from "../_shared/reservation-create.ts";
import {
  DEFAULT_TIME_WINDOW,
  PASSED_GRACE_MS,
  SEATING_VALUES,
  TIME_WINDOW_VALUES,
} from "../_shared/reservation-doc.ts";
import { isBeyondBookingHorizon } from "../_shared/reservation-bounds.ts";
import { DEFAULT_ZONE, zoneMonthStart } from "../_shared/local-time.ts";
import {
  PLACE_CLOSED_CODE,
  PLACE_CLOSED_MESSAGE,
  slotInHours,
} from "../_shared/reservation-hours.ts";
import { fromPlaceIdRow } from "../_shared/place-id.ts";
import { accountDeletedResponse, isDeletedConsumer } from "../_shared/delete-history-free.ts";
import { isPlaceProfileReady } from "../_shared/place-state.ts";
import {
  RESERVATIONS_OFF_CODE,
  RESERVATIONS_OFF_MESSAGE,
  readReservable,
} from "../_shared/place-reservable.ts";
import {
  monthlyReservationCap,
  RESERVATION_LIMIT_CODE,
  RESERVATION_LIMIT_MESSAGE,
} from "../_shared/reservation-cap.ts";
import { effectivePlan, needsRefresh, PLAN_COLUMNS, type PlanRow, syncPlan } from "../_shared/guest-plan.ts";
import { boostLivemode, boostStripeKey, stripeClient } from "../_shared/stripe.ts";

type Body = {
  project_id?: string;
  reserved_at?: string;
  party_size?: number;
  notes?: string;
  /** The name the table is under (MESITA-3607). Older clients omit it and
   *  book under the profile's last name. */
  first_name?: string;
  last_name?: string;
  consumer_notify?: string;
  request_id?: string;
  /** MESITA-3957: 0 · 30 · 60; older clients omit it and get the default. */
  time_window_minutes?: number;
  /** MESITA-3957: any · inside · outside · bar. */
  seating?: string;
  confirm_notify?: string;
};

const TICKET_COLUMNS =
  "id, reference_code, reserved_at, party_size, state, notes, consumer_notify, created_at, place_id, time_window_minutes, seating";

serveJson("consumer-web-create-reservation", async (req) => {
  const ctx = await requireConsumerRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;
  const consumerId = user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  if (!body.project_id || typeof body.project_id !== "string") {
    return json({ ok: false, error: "project_id required" }, 400);
  }
  if (!body.reserved_at || typeof body.reserved_at !== "string") {
    return json({ ok: false, error: "reserved_at (ISO 8601) required" }, 400);
  }
  const testRefused = await refuseOutsideTestPlace(ctx, body.project_id);
  if (testRefused) return testRefused;
  const reservedAt = new Date(body.reserved_at);
  if (Number.isNaN(reservedAt.getTime())) {
    return json({ ok: false, error: "reserved_at must be a valid ISO 8601 timestamp" }, 400);
  }
  // A past slot must never reach the Booker — it would phone a place to ask for
  // a table that has already come and gone. The clients block past slots in the
  // picker, but this is the real gate: consumer-web-update-reservation has
  // always rejected past instants and create silently did not.
  if (reservedAt.getTime() < Date.now()) {
    return json({ ok: false, error: "Pick a time in the future." }, 400);
  }
  // Keep in lock-step with consumer-web-update-reservation (MAX_PARTY=10)
  // and both consumer UIs — create must not accept sizes update rejects.
  const MAX_PARTY = 10; // MESITA-3613
  const partySize = Math.trunc(Number(body.party_size));
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > MAX_PARTY) {
    return json({ ok: false, error: `party_size must be 1..${MAX_PARTY}` }, 400);
  }
  const guestNotify = body.consumer_notify === "app" ? "app" : "call";
  // How a confirmed table reaches the guest (MESITA-4187): app unless asked.
  const confirmNotify = body.confirm_notify === "call" ? "call" : "app";
  const timeWindow = body.time_window_minutes === undefined || body.time_window_minutes === null
    ? DEFAULT_TIME_WINDOW
    : body.time_window_minutes;
  if (!(TIME_WINDOW_VALUES as readonly unknown[]).includes(timeWindow)) {
    return json({ ok: false, error: `time_window_minutes must be one of ${TIME_WINDOW_VALUES.join(", ")}` }, 400);
  }
  const seating = body.seating === undefined || body.seating === null ? "any" : body.seating;
  if (!(SEATING_VALUES as readonly unknown[]).includes(seating)) {
    return json({ ok: false, error: `seating must be one of ${SEATING_VALUES.join(", ")}` }, 400);
  }
  const requestId = readRequestId(body.request_id);
  const reservedAtIso = reservedAt.toISOString();

  // ── One tap, one reservation (MESITA-3619) ──────────────────────────────
  // Before every other gate: a replay must return its ticket even if the
  // cap has since filled.
  const guardStore: CreateGuardStore = {
    async byRequest(cid, rid) {
      const { data, error } = await admin
        .from("reservation_tickets")
        .select(TICKET_COLUMNS)
        .eq("consumer_id", cid)
        .eq("request_id", rid)
        .maybeSingle();
      if (error) throw new Error(`request lookup failed: ${error.message}`);
      return fromPlaceIdRow(data ?? null) as CreateTicket | null;
    },
    async liveHere(cid, pid, since) {
      const { data, error } = await admin
        .from("reservation_tickets")
        .select(TICKET_COLUMNS)
        .eq("consumer_id", cid)
        .eq("place_id", pid)
        .gte("reserved_at", since)
        .in("state", ["pending", "confirmed"])
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`duplicate lookup failed: ${error.message}`);
      return fromPlaceIdRow(data ?? null) as CreateTicket | null;
    },
  };
  let guard;
  try {
    guard = await guardCreate(guardStore, {
      consumerId,
      placeId: body.project_id,
      reservedAtIso,
      requestId,
    });
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
  if (guard.kind === "replay") {
    const [withPlace] = await attachPlaces(admin, [guard.ticket as { project_id?: string | null }]);
    return json({ ok: true, reservation: withPlace ?? guard.ticket, call_triggered: false, replayed: true });
  }
  if (guard.kind === "duplicate") {
    return json({
      ok: false,
      code: ALREADY_RESERVED_CODE,
      error: ALREADY_RESERVED_MESSAGE,
      reservation_id: guard.ticket.id,
    }, 409);
  }

  // ── The place must still exist ──────────────────────────────────────────
  // Clients can hold a place id that has since been deleted — the swipe deck
  // persists its card list in sessionStorage, and an admin reset re-creates
  // places under FRESH uuids. Without this check the insert reaches Postgres
  // and the raw FK message ("violates foreign key constraint
  // reservation_tickets_place_id_fkey") is what the guest reads. Fail clean,
  // and give the client a code it can act on.
  //
  // The constraint was `reservations_project_id_fkey` when this was written;
  // the rename carried it too, so the old name is a message no guest can see
  // any more (MESITA-1718, verified against the live catalog).
  const { data: placeRow, error: placeErr } = await admin
    .from("places")
    .select("id, content_state")
    .eq("id", body.project_id)
    .maybeSingle();
  if (placeErr) return json({ ok: false, error: placeErr.message }, 500);
  if (!placeRow) {
    return json({
      ok: false,
      code: "place_not_found",
      error: "That place isn't available anymore. Refresh to get the latest list.",
    }, 404);
  }
  if (!isPlaceProfileReady((placeRow as { content_state?: unknown }).content_state)) {
    return json({
      ok: false,
      code: "profile_not_ready",
      error: "This place's profile hasn't been created yet.",
    }, 409);
  }

  // ── The place must take reservations (MESITA-2156, MESITA-3622) ────────
  // The switch on AND a number to call. Every client shows Reserve Off
  // otherwise, but a stale tab or a direct call would still make a ticket
  // nobody can ring.
  const reservable = await readReservable(admin, body.project_id);
  if (reservable.error) return json({ ok: false, error: reservable.error }, 500);
  if (!reservable.reservable) {
    return json({
      ok: false,
      code: RESERVATIONS_OFF_CODE,
      error: RESERVATIONS_OFF_MESSAGE,
    }, 409);
  }

  // ── The time must be inside the place's hours (MESITA-3953) ────────────
  // The form offers only those times; a stale tab or a direct call doesn't.
  if (slotInHours(reservable.hours, reservable.zone, reservedAt) === false) {
    return json({ ok: false, code: PLACE_CLOSED_CODE, error: PLACE_CLOSED_MESSAGE }, 409);
  }
  // One calendar month ahead, on the place's clock (MESITA-4139). The form
  // already stops there; a direct call must not book past it.
  if (isBeyondBookingHorizon(reservedAt, new Date(), reservable.zone || DEFAULT_ZONE)) {
    return json({ ok: false, error: "Pick a time within the next month." }, 400);
  }

  const { data: consumerRow, error: consumerErr } = await admin
    .from("consumers")
    .select(`deleted_at, ${PLAN_COLUMNS}`)
    .eq("id", consumerId)
    .maybeSingle();
  if (consumerErr) return json({ ok: false, error: consumerErr.message }, 500);
  if (isDeletedConsumer(consumerRow)) return accountDeletedResponse();

  // ── The booking name (MESITA-1806) ──────────────────────────────────────
  // THE gate for the last name. Onboarding stopped asking for it — it is four
  // fields in front of someone who hasn't seen a place yet — and the
  // reservation sheet asks instead, where the guest can see why. This is the
  // half that actually enforces it: the client's field is a courtesy, and a
  // client cached from before that shipped has no field at all.
  //
  // It is not cosmetic. supabase-edgefunc-place-reservation-call books the table
  // under the full name (host systems key on "last name + party size"), and
  // when the place calls back, eleven-agent-get-reservation finds the booking
  // by fuzzy first/last match. A first-name-only booking is a table nobody can
  // find. Tickets deliberately did NOT gate this way — validate-web-get-ticket
  // fell back to the first name at the door (retired, MESITA-2090).
  const cleanName = (v: unknown) => (typeof v === "string" ? v.trim().slice(0, 60) : "");
  const firstName = cleanName(body.first_name);
  const lastName = cleanName(body.last_name);
  // Both names, always (MESITA-3629, Pato: "first and last names must be
  // mandatory"): the profile's last name no longer stands in for them.
  if (!firstName || !lastName) {
    return json({
      ok: false,
      code: "name_required",
      error: "Add the first and last name the table is under.",
    }, 400);
  }

  // ── Monthly reservation cap (_shared/reservation-cap.ts) ────────────────
  // Each reservation is a metered call. The cap is the guest's plan's, or the
  // one an operator set for them (MESITA-2555). The admin testing switch (app_config.reservations_config.unlimitedReservations)
  // lifts it for EVERY consumer so a tester isn't blocked mid-run. Defaults
  // off; the admin Reservations Config page owns it.
  const { data: settingsRow } = await admin
    .from("app_config")
    .select("reservations_config")
    .eq("id", 1)
    .maybeSingle();
  const capLifted =
    (settingsRow?.reservations_config as { unlimitedReservations?: unknown } | null)
      ?.unlimitedReservations === true;

  // Pro is paid by subscription (MESITA-3870, _shared/guest-plan.ts): a
  // paid period that ran out is read back from Stripe once before the
  // plan's cap applies, so a renewal Stripe already charged never blocks.
  let cap: number | null = null;
  if (!capLifted) {
    const livemode = boostLivemode();
    let planRow = consumerRow as PlanRow | null;
    const stripeKey = boostStripeKey();
    if (stripeKey && needsRefresh(planRow, Date.now(), livemode)) {
      try {
        planRow = await syncPlan(admin, stripeClient(stripeKey), consumerId, String(planRow!.plan_stripe_subscription), livemode);
      } catch (err) {
        console.error("[consumer-web-create-reservation] plan_sync_failed", JSON.stringify({ consumer_id: consumerId, error: String(err) }));
      }
    }
    cap = monthlyReservationCap({
      plan: effectivePlan(planRow, Date.now(), livemode),
      reservation_cap_override: planRow?.reservation_cap_override,
    });
  }
  // The guest's month is Mexico City's (MESITA-3626): the cap is the
  // guest's, not a place's.
  const monthStart = zoneMonthStart(new Date(), DEFAULT_ZONE);
  const liveSince = new Date(Date.now() - PASSED_GRACE_MS).toISOString();

  // Count, live-ticket check and insert are one locked call (MESITA-4139).
  // A reference-code collision redraws; anything else stops the loop.
  let reservation: { id: string } & Record<string, unknown> | null = null;
  let insertError = "insert failed";
  for (let i = 0; i < 3 && !reservation; i++) {
    const { data, error } = await admin.rpc("reservation_insert_capped", {
      p_consumer_id: consumerId,
      p_place_id: body.project_id,
      p_reference_code: generateReservationCode(),
      p_reserved_at: reservedAtIso,
      p_party_size: partySize,
      p_notes: (body.notes ?? "").trim() || null,
      p_consumer_notify: guestNotify,
      p_confirm_notify: confirmNotify,
      p_guest_first_name: firstName,
      p_guest_last_name: lastName,
      p_request_id: requestId,
      p_time_window_minutes: timeWindow,
      p_seating: seating,
      p_month_start: monthStart.toISOString(),
      p_cap: cap,
      p_live_since: liveSince,
    });
    if (error) {
      insertError = error.message;
      break;
    }
    const result = data as {
      ok?: boolean;
      replay?: boolean;
      id?: string;
      code?: string;
      reservation_id?: string;
      limit?: number;
    } | null;
    if (result?.ok && result.replay && result.id) {
      const { data: priorRow, error: priorErr } = await admin
        .from("reservation_tickets")
        .select(TICKET_COLUMNS)
        .eq("id", result.id)
        .maybeSingle();
      if (priorErr) return json({ ok: false, error: priorErr.message }, 500);
      const prior = fromPlaceIdRow(priorRow ?? null) as CreateTicket | null;
      if (prior) {
        const [withPlace] = await attachPlaces(admin, [prior as { project_id?: string | null }]);
        return json({ ok: true, reservation: withPlace ?? prior, call_triggered: false, replayed: true });
      }
    }
    if (result?.ok && result.id) {
      const { data: row, error: readErr } = await admin
        .from("reservation_tickets")
        .select(TICKET_COLUMNS)
        .eq("id", result.id)
        .maybeSingle();
      if (readErr || !row) {
        insertError = readErr?.message ?? "insert failed";
        break;
      }
      reservation = fromPlaceIdRow(row) as { id: string } & Record<string, unknown>;
      break;
    }
    if (result?.code === "reference_taken") continue;
    if (result?.code === "already_reserved") {
      return json({
        ok: false,
        code: ALREADY_RESERVED_CODE,
        error: ALREADY_RESERVED_MESSAGE,
        reservation_id: result.reservation_id,
      }, 409);
    }
    if (result?.code === "reservation_limit_reached") {
      return json({
        ok: false,
        code: RESERVATION_LIMIT_CODE,
        error: RESERVATION_LIMIT_MESSAGE,
        limit: result.limit ?? cap,
      }, 409);
    }
    insertError = result?.code ?? "insert failed";
    break;
  }
  if (!reservation) {
    return json({ ok: false, error: insertError }, 500);
  }

  // Same flat `place` shape the clients already speak.
  const [withPlace] = await attachPlaces(admin, [
    reservation as { project_id?: string | null },
  ]);

  // Hand off to the Reservationist: it rings the place now if it is open, or
  // parks the ticket for opening time (_shared/reservation-retry.ts
  // firstCallPlan).
  // Best-effort — the reservation already exists, so a call-trigger failure must
  // NOT fail the request: the ticket was born scheduled and due now, so the
  // minute cron pushes it again (MESITA-3619).
  const call = await invokeInternalCaller(
    env,
    "consumer-web-create-reservation",
    "supabase-edgefunc-place-reservation-call",
    { reservation_id: reservation.id },
  );

  return json({
    ok: true,
    reservation: withPlace ?? reservation,
    call_triggered: call.ok,
  });
});
