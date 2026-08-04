// Supabase Edge Function — business-web-confirm-reservation
//
// Authenticated. The place confirms or declines a reservation. Membership-
// gated and scoped to the place (the update is filtered by project_id) so a
// member can only act on that place's bookings. Mirrors the reservation
// lifecycle: pending/confirmed -> confirmed | declined.
//
// CONSOLE CONFIRM TELLS THE GUEST (eng-review 2026-08-04): the phone path
// always follows a venue yes with the a2 guest call; this door used to flip
// status silently. Now a confirm SEEDS the callback (callback_state=
// 'scheduled' on the guest ladder's clock — quiet-hours aware) and the
// minute cron fires the engine's callback_retry intent through its normal
// CAS claim. run_id rotates so any stale engine run is orphaned.
//
// Deploy: supabase functions deploy business-web-confirm-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, readPlaceIdAlias } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";
import { RESERVATION_SELECT } from "../_shared/reservation-columns.ts";
import { nextGuestCallAt } from "../_shared/reservation-callback.ts";

type Decision = "confirm" | "decline";
type Body = { placeId?: string; projectId?: string; reservationId?: string; decision?: Decision };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const projectId = readPlaceIdAlias(body);
  const reservationId = (body.reservationId ?? "").toString().trim();
  const decision = body.decision;
  if (!projectId) return json({ ok: false, error: "projectId is required" }, 400);
  if (!reservationId) {
    return json({ ok: false, error: "reservationId is required" }, 400);
  }
  if (decision !== "confirm" && decision !== "decline") {
    return json({ ok: false, error: "decision must be confirm or decline" }, 400);
  }

  const admin = adminClient(envRes.env);
  const memberRes = await requireMembership(admin, authRes.user, projectId);
  if (!memberRes.ok) return memberRes.response;

  // The guest-callback seed needs the slot + the venue's longitude (quiet
  // hours run venue-local). Read them before the write.
  const { data: current } = await admin
    .from("reservations")
    .select("reserved_at, guest_confirmed_at")
    .eq("id", reservationId)
    .eq("project_id", projectId)
    .maybeSingle();
  const { data: placeRow } = await admin
    .from("places")
    .select("lng")
    .eq("id", projectId)
    .maybeSingle();
  const lng = typeof placeRow?.lng === "number" ? placeRow.lng : null;

  const nowIso = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (decision === "confirm") {
    patch = {
      status: "confirmed",
      confirmed_at: nowIso,
      updated_at: nowIso,
      run_id: crypto.randomUUID(),
      claimed_at: null,
    };
    // Seed the a2 call unless the guest already confirmed their side. The
    // ladder's own schedule (~10 min out, held to 09:00–22:00 venue-local)
    // keeps a 1 a.m. console confirm from ringing anyone at 1 a.m.
    if (!current?.guest_confirmed_at) {
      const reservedAt = current?.reserved_at ? new Date(current.reserved_at) : null;
      const first = nextGuestCallAt(0, lng, reservedAt);
      if (first) {
        patch.callback_state = "scheduled";
        patch.callback_next_attempt_at = first.at.toISOString();
        patch.callback_attempts = 0;
        patch.last_call_status = "confirmed from the console — guest call scheduled";
      }
    }
  } else {
    patch = {
      status: "declined",
      updated_at: nowIso,
      run_id: crypto.randomUUID(),
      claimed_at: null,
      callback_state: "skipped",
      callback_next_attempt_at: null,
      next_attempt_at: null,
    };
  }

  // Scope the update to this place and to still-actionable states so a
  // member can't flip a terminal booking (declined / no_show / cancelled).
  const { data, error } = await admin
    .from("reservations")
    .update(patch)
    .eq("id", reservationId)
    .eq("project_id", projectId)
    .in("status", ["pending", "confirmed"])
    .select(RESERVATION_SELECT)
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, 500);
  if (!data) {
    return json(
      { ok: false, error: "Reservation not found or no longer actionable" },
      404,
    );
  }
  return json({ ok: true, reservation: data });
});
