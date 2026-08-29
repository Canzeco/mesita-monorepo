// Supabase Edge Function — consumer-web-create-reservation (product caller)
//
// Authenticated. Creates a reservation row for the caller. The reservation
// carries NO discount surface at all, deliberately: a reward comes from
// SHOWING UP, never from holding a booking. The rates are snapshotted onto
// the visit ticket when the guest actually arrives.
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
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { getTierConfig, perkClassKey } from "../_shared/membership.ts";
import { invokeInternalCaller } from "../_shared/internal.ts";
import { generateReservationCode, isUniqueViolation } from "../_shared/reservation-code.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";
import { writeReservation } from "../_shared/reservation-doc.ts";
import { accountDeletedResponse, isDeletedConsumer } from "../_shared/delete-history-free.ts";
import { isPlaceProfileReady } from "../_shared/place-status.ts";

type Body = {
  project_id?: string;
  reserved_at?: string;
  party_size?: number;
  notes?: string;
  consumer_notify?: string;
};

Deno.serve(async (req) => {
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
  // A past slot must never reach the Booker — it would phone a venue to ask for
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
  // Clients can hold a project_id that has since been deleted — the swipe deck
  // persists its card list in sessionStorage, and an admin reset re-creates
  // places under FRESH uuids. Without this check the insert reaches Postgres
  // and the raw FK message ("violates foreign key constraint
  // reservations_project_id_fkey") is what the guest reads. Fail clean, and
  // give the client a code it can act on.
  const { data: projectRow, error: projectErr } = await admin
    .from("projects")
    .select("id, content_status")
    .eq("id", body.project_id)
    .maybeSingle();
  if (projectErr) return json({ ok: false, error: projectErr.message }, 500);
  if (!projectRow) {
    return json({
      ok: false,
      code: "place_not_found",
      error: "That place isn't available anymore. Refresh to get the latest list.",
    }, 404);
  }
  if (!isPlaceProfileReady((projectRow as { content_status?: unknown }).content_status)) {
    return json({
      ok: false,
      code: "profile_not_ready",
      error: "This place's profile hasn't been created yet.",
    }, 409);
  }

  // ── Monthly reservation cap (Premium perk: "more reservations") ─────────
  // Free guests are limited per calendar month; Premium is unlimited (null
  // limit). The limit lives on the plans lookup so it's tunable
  // without a deploy. Cancelled reservations don't count against the cap.
  const { data: consumerRow, error: consumerErr } = await admin
    .from("consumers")
    .select("class_key, plan, deleted_at")
    .eq("id", consumerId)
    .maybeSingle();
  if (consumerErr) return json({ ok: false, error: consumerErr.message }, 500);
  if (isDeletedConsumer(consumerRow)) return accountDeletedResponse();

  // Admin testing switch (app_config.reservations_config.unlimitedReservations)
  // lifts the cap for EVERY consumer so a tester isn't blocked mid-run. Defaults
  // off; the admin Reservations Config page owns it.
  const { data: settingsRow } = await admin
    .from("app_config")
    .select("reservations_config")
    .eq("id", 1)
    .maybeSingle();
  const capLifted =
    (settingsRow?.reservations_config as { unlimitedReservations?: unknown } | null)
      ?.unlimitedReservations === true;

  const tier = await getTierConfig(
    admin,
    perkClassKey(consumerRow?.class_key, consumerRow?.plan),
  );
  const monthlyLimit = capLifted ? null : (tier?.monthly_reservation_limit ?? null);
  if (monthlyLimit != null) {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count, error: countErr } = await admin
      .from("reservation_tickets")
      .select("id", { count: "exact", head: true })
      .eq("consumer_id", consumerId)
      .eq("is_test", false)
      .gte("created_at", monthStart.toISOString())
      .neq("status", "cancelled");
    if (countErr) return json({ ok: false, error: countErr.message }, 500);
    if ((count ?? 0) >= monthlyLimit) {
      return json(
        {
          ok: false,
          code: "reservation_limit_reached",
          error:
            "You've reached your monthly reservation limit. Upgrade to Mesita Premium for unlimited reservations.",
          limit: monthlyLimit,
          tier: consumerRow?.class_key ?? "bronze",
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
    // NO `place:places(...)` embed here — reservations→places is a two-hop FK
    // (reservations.project_id → projects.id → places.id), so PostgREST fails
    // with "Could not find a relationship between 'reservations' and 'places'
    // in the schema cache". Select project_id and stitch via attachPlaces,
    // exactly like the list EFs (#518/#523).
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
        status: "pending",
      },
      select:
        "id, reference_code, reserved_at, party_size, status, notes, consumer_notify, created_at, place_id",
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

  // Attempt 1 is immediate: hand off to the Reservationist to phone the venue.
  // Best-effort — the reservation already exists, so a call-trigger failure must
  // NOT fail the request (the call EF returns 503 until ELEVENLABS_KEY is set).
  const call = await invokeInternalCaller(
    envRes.env,
    "consumer-web-create-reservation",
    "supabase-edgefunc-reservation-call",
    { reservation_id: reservation.id },
  );

  return json({
    ok: true,
    reservation: withPlace ?? reservation,
    call_triggered: call.ok,
  });
});
