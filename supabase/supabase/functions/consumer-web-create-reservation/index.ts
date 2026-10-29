// Supabase Edge Function — consumer-web-create-reservation (product caller)
//
// Authenticated. Creates a reservation row for the caller and hands it to
// the Reservationist, capped per guest per month (_shared/reservation-cap.ts).
//
// Body:
//   { project_id: uuid, reserved_at: iso8601, party_size: int, notes?: string,
//     consumer_notify?: "call" | "app" }  // default "call" (MESITA-787)
//
// Response:
//   { ok: true, reservation: {…} }
//
// Deploy: supabase functions deploy consumer-web-create-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { invokeInternalCaller } from "../_shared/internal.ts";
import { generateReservationCode, isUniqueViolation } from "../_shared/reservation-code.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";
import { writeReservation } from "../_shared/reservation-doc.ts";
import { accountDeletedResponse, isDeletedConsumer } from "../_shared/delete-history-free.ts";
import { isPlaceProfileReady } from "../_shared/place-state.ts";
import {
  RESERVATIONS_OFF_CODE,
  RESERVATIONS_OFF_MESSAGE,
  takesReservations,
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
  consumer_notify?: string;
};

serveJson("consumer-web-create-reservation", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

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
  // Keep in lock-step with consumer-web-update-reservation (MAX_PARTY=20)
  // and both consumer UIs — create must not accept sizes update rejects.
  const MAX_PARTY = 20;
  const partySize = Math.trunc(Number(body.party_size));
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > MAX_PARTY) {
    return json({ ok: false, error: `party_size must be 1..${MAX_PARTY}` }, 400);
  }
  const guestNotify = body.consumer_notify === "app" ? "app" : "call";

  const admin = adminClient(envRes.env);

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

  // ── The place must take reservations (MESITA-2156) ──────────────────────
  // Every client hides Reserve when reservations_enabled is false, but a
  // stale tab or a direct call would still ring a walk-in place.
  const { data: profileRow, error: profileErr } = await admin
    .from("place_profiles")
    .select("reservations_enabled")
    .eq("id", body.project_id)
    .maybeSingle();
  if (profileErr) return json({ ok: false, error: profileErr.message }, 500);
  if (!takesReservations(profileRow as { reservations_enabled?: boolean | null } | null)) {
    return json({
      ok: false,
      code: RESERVATIONS_OFF_CODE,
      error: RESERVATIONS_OFF_MESSAGE,
    }, 409);
  }

  const { data: consumerRow, error: consumerErr } = await admin
    .from("consumers")
    .select("deleted_at, last_name, plan, reservation_cap_override")
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
  if (!(consumerRow as { last_name?: string | null } | null)?.last_name) {
    return json({
      ok: false,
      code: "last_name_required",
      error: "Add your last name — it's the name your table is booked under.",
    }, 409);
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
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
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
        reserved_at: reservedAt.toISOString(),
        party_size: partySize,
        notes: (body.notes ?? "").trim() || null,
        consumer_notify: guestNotify,
        state: "pending",
      },
      select:
        "id, reference_code, reserved_at, party_size, state, notes, consumer_notify, created_at, place_id",
    });
    if (ins.ok) {
      reservation = ins.row as { id: string } & Record<string, unknown>;
      insertError = null;
    } else {
      insertError = { message: ins.error };
      if (!isUniqueViolation({ code: ins.code })) break;
    }
  }
  if (!reservation) {
    return json({ ok: false, error: insertError?.message ?? "insert failed" }, 500);
  }

  // Same flat `place` shape the clients already speak.
  const [withPlace] = await attachPlaces(admin, [
    reservation as { project_id?: string | null },
  ]);

  // Attempt 1 is immediate: hand off to the Reservationist to phone the place.
  // Best-effort — the reservation already exists, so a call-trigger failure must
  // NOT fail the request (the call EF returns 503 until ELEVENLABS_KEY is set).
  const call = await invokeInternalCaller(
    envRes.env,
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
