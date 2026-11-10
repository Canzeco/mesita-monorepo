// Supabase Edge Function — consumer-web-create-reservation (product caller)
//
// Authenticated. Creates a reservation row for the caller and hands it to
// the Reservationist, capped per guest per month (_shared/reservation-cap.ts).
//
// Body:
//   { project_id: uuid, reserved_at: iso8601, party_size: int, notes?: string,
//     consumer_notify?: "call" | "app",  // default "call" (MESITA-787)
//     request_id?: uuid }                 // one per Reserve request (MESITA-3619)
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
import { invokeInternalCaller } from "../_shared/internal.ts";
import { generateReservationCode, isUniqueViolation } from "../_shared/reservation-code.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";
import {
  ALREADY_RESERVED_CODE,
  ALREADY_RESERVED_MESSAGE,
  type CreateGuardStore,
  type CreateTicket,
  createdTicketSchedule,
  guardCreate,
  readRequestId,
} from "../_shared/reservation-create.ts";
import { writeReservation } from "../_shared/reservation-doc.ts";
import { DEFAULT_ZONE, zoneMonthStart } from "../_shared/local-time.ts";
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
};

const TICKET_COLUMNS =
  "id, reference_code, reserved_at, party_size, state, notes, consumer_notify, created_at, place_id";

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

  const { data: consumerRow, error: consumerErr } = await admin
    .from("consumers")
    .select("deleted_at, plan, reservation_cap_override")
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

  if (!capLifted) {
    const cap = monthlyReservationCap(
      consumerRow as { plan?: unknown; reservation_cap_override?: unknown } | null,
    );
    // The guest's month is Mexico City's (MESITA-3626): the cap is the
    // guest's, not a place's, and the market's calendar is the one they live
    // by — a booking at 7 p.m. on the 31st counts in that month, not the next
    // UTC one.
    const monthStart = zoneMonthStart(new Date(), DEFAULT_ZONE);
    const { count, error: countErr } = await admin
      .from("reservation_tickets")
      .select("id", { count: "exact", head: true })
      .eq("consumer_id", consumerId)
      .eq("is_test", false)
      .gte("created_at", monthStart.toISOString())
      .neq("state", "cancelled");
    if (countErr) return json({ ok: false, error: countErr.message }, 500);
    if ((count ?? 0) >= cap) {
      return json(
        {
          ok: false,
          code: RESERVATION_LIMIT_CODE,
          error: RESERVATION_LIMIT_MESSAGE,
          limit: cap,
        },
        409,
      );
    }
  }

  // Insert with the ticket's 8-digit reference code — fresh code per try; a
  // unique-index collision just redraws.
  let reservation: { id: string } & Record<string, unknown> | null = null;
  let insertError: { message: string } | null = null;
  for (let i = 0; i < 3 && !reservation; i++) {
    // NO `place:place_profiles(...)` embed here — the FK chain is two hops
    // (reservation_tickets.place_id → places.id → place_profiles.id), so PostgREST
    // fails with "Could not find a relationship between 'reservation_tickets' and
    // 'place_profiles' in the schema cache". Select place_id and stitch via
    // attachPlaces, exactly like the list EFs (#518/#523).
    //
    // The table was `reservations` and the column `project_id` when this was
    // written; both were renamed and the comment was not (MESITA-1718).
    const ins = await writeReservation(admin, {
      mode: "insert",
      patch: {
        consumer_id: consumerId,
        project_id: body.project_id,
        reference_code: generateReservationCode(),
        reserved_at: reservedAtIso,
        party_size: partySize,
        notes: (body.notes ?? "").trim() || null,
        consumer_notify: guestNotify,
        state: "pending",
        guest_first_name: firstName,
        guest_last_name: lastName,
        request_id: requestId,
        ...createdTicketSchedule(),
      },
      select: TICKET_COLUMNS,
    });
    if (ins.ok) {
      reservation = ins.row as { id: string } & Record<string, unknown>;
      insertError = null;
    } else {
      insertError = { message: ins.error };
      if (!isUniqueViolation({ code: ins.code })) break;
      // The same request raced itself past the guard: return its ticket.
      if (requestId) {
        const prior = await guardStore.byRequest(consumerId, requestId).catch(() => null);
        if (prior) {
          const [withPlace] = await attachPlaces(admin, [prior as { project_id?: string | null }]);
          return json({ ok: true, reservation: withPlace ?? prior, call_triggered: false, replayed: true });
        }
      }
    }
  }
  if (!reservation) {
    return json({ ok: false, error: insertError?.message ?? "insert failed" }, 500);
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
