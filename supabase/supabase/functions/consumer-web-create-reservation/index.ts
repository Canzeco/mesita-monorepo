// Supabase Edge Function — consumer-web-create-reservation (product caller)
//
// Authenticated. Creates a reservation row for the caller and, if the
// consumer already has an active coupon for the same place (because
// they previously saved it), links that coupon to the reservation via
// `coupon_id`. The reservation row deliberately carries NO discount
// info — the linked coupon owns the discount surface.
//
// Body:
//   { project_id: uuid, reserved_at: iso8601, party_size: int, notes?: string,
//     guest_notify?: "call" | "app" }  // default "call" (MESITA-787)
//
// Response:
//   { ok: true, reservation: {…}, linked_coupon_id: uuid|null }
//
// Deploy: supabase functions deploy consumer-web-create-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { getTierConfig } from "../_shared/membership.ts";
import { invokeInternalCaller } from "../_shared/internal.ts";
import { generateReservationCode, isUniqueViolation } from "../_shared/reservation-code.ts";
import { attachPlaces } from "../_shared/reservation-places.ts";

type Body = {
  project_id?: string;
  reserved_at?: string;
  party_size?: number;
  notes?: string;
  guest_notify?: string;
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
  const partySize = Math.trunc(Number(body.party_size));
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > 50) {
    return json({ ok: false, error: "party_size must be 1..50" }, 400);
  }
  const guestNotify = body.guest_notify === "app" ? "app" : "call";

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
    .select("id")
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

  // ── Monthly reservation cap (Premium perk: "more reservations") ─────────
  // Free guests are limited per calendar month; Premium is unlimited (null
  // limit). The limit lives on the plans lookup so it's tunable
  // without a deploy. Cancelled reservations don't count against the cap.
  const { data: consumerRow, error: consumerErr } = await admin
    .from("consumers")
    .select("class_key")
    .eq("id", consumerId)
    .maybeSingle();
  if (consumerErr) return json({ ok: false, error: consumerErr.message }, 500);

  // Admin testing switch (app_settings.reservations_config.unlimitedReservations)
  // lifts the cap for EVERY consumer so a tester isn't blocked mid-run. Defaults
  // off; the admin Reservations Config page owns it.
  const { data: settingsRow } = await admin
    .from("app_settings")
    .select("reservations_config")
    .eq("id", 1)
    .maybeSingle();
  const capLifted =
    (settingsRow?.reservations_config as { unlimitedReservations?: unknown } | null)
      ?.unlimitedReservations === true;

  const tier = await getTierConfig(admin, consumerRow?.class_key ?? "standard");
  const monthlyLimit = capLifted ? null : (tier?.monthly_reservation_limit ?? null);
  if (monthlyLimit != null) {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count, error: countErr } = await admin
      .from("reservations")
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
          tier: consumerRow?.class_key ?? "standard",
        },
        409,
      );
    }
  }

  // Look up an active coupon for this (consumer, place) so we can link it.
  // We don't fail if none exists — the place might be a web listing
  // (no coupons), or the consumer might not have saved it yet.
  const { data: coupon } = await admin
    .from("coupons")
    .select("id")
    .eq("consumer_id", consumerId)
    .eq("project_id", body.project_id)
    .eq("status", "active")
    .maybeSingle();

  // Insert with the ticket's 8-digit reference code — fresh code per try; a
  // unique-index collision just redraws.
  let reservation: { id: string } & Record<string, unknown> | null = null;
  let insertError: { message: string } | null = null;
  for (let i = 0; i < 3 && !reservation; i++) {
    const ins = await admin
      .from("reservations")
      .insert({
        consumer_id: consumerId,
        project_id: body.project_id,
        coupon_id: coupon?.id ?? null,
        reference_code: generateReservationCode(),
        reserved_at: reservedAt.toISOString(),
        party_size: partySize,
        notes: (body.notes ?? "").trim() || null,
        guest_notify: guestNotify,
        status: "pending",
      })
      // NO `place:places(...)` embed here — reservations→places is a two-hop FK
      // (reservations.project_id → projects.id → places.id), so PostgREST fails
      // with "Could not find a relationship between 'reservations' and 'places'
      // in the schema cache". Select project_id and stitch via attachPlaces,
      // exactly like the list EFs (#518/#523).
      .select(
        "id, reference_code, reserved_at, party_size, status, notes, guest_notify, coupon_id, created_at, project_id",
      )
      .single();
    if (!ins.error) {
      reservation = ins.data as { id: string } & Record<string, unknown>;
      insertError = null;
    } else {
      insertError = ins.error;
      if (!isUniqueViolation(ins.error)) break;
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
    linked_coupon_id: coupon?.id ?? null,
    call_triggered: call.ok,
  });
});
