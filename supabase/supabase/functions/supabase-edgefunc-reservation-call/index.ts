// Supabase Edge Function — supabase-edgefunc-reservation-call (internal / artificial caller)
//
// The Reservationist's "attempt 1 is immediate": places the outbound phone call
// for a freshly-created reservation. Invoked by consumer-web-create-reservation
// right after it inserts the pending row (best-effort — a call failure never fails
// the reservation).
//
// What it does:
//   1. Loads the reservation (+ guest name + place).
//   2. Reads Reservations Config (app_settings.reservations_config): while TEST
//      MODE is on it dials the ONE test number for every reservation; otherwise it
//      dials the place's products.reservations phone endpoint. Test mode defaults
//      ON, so a config that predates the knob never rings a real venue.
//   3. Resolves the agent's imported Twilio number and POSTs to ElevenLabs' Convai
//      outbound-call API with the booking as dynamic variables.
//   4. Records the attempt on the reservation. It does NOT change reservation.status
//      — that flips pending→confirmed on the post-call webhook (follow-up).
//
// Auth: verify_jwt = true (config.toml) + requireInternalCaller — internal callers
// only. Requires the ELEVENLABS_KEY secret; agent id + outbound line default to the
// Reservationist wiring (env-overridable).
//
// Deploy: supabase functions deploy supabase-edgefunc-reservation-call

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { coerceReservationsCallConfig } from "../_shared/reservations-config.ts";
import {
  elevenLabsKey,
  placeOutboundCall,
  reservationAgentId,
  reservationFromNumber,
  resolvePhoneNumberId,
} from "../_shared/elevenlabs.ts";

type Body = { reservation_id?: string };

type ConsumerName = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
};

type Place = {
  name?: string | null;
  phone?: string | null;
  products?: Record<string, unknown> | null;
};

function guestName(c: ConsumerName | null): string {
  if (!c) return "el cliente";
  const full = c.full_name?.trim();
  if (full) return full;
  const joined = [c.first_name, c.last_name]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return joined || "el cliente";
}

// Spanish, Mexico-City local — the agent reads these back to the venue.
function esDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
function esTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = requireInternalCaller(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const reservationId = bodyRes.body.reservation_id;
  if (!reservationId || typeof reservationId !== "string") {
    return json({ ok: false, error: "reservation_id required" }, 400);
  }

  const key = elevenLabsKey();
  if (!key) return json({ ok: false, error: "ELEVENLABS_KEY not configured" }, 503);

  const admin = adminClient(envRes.env);

  // Fetch place by project_id directly — reservations.project_id has no PostgREST
  // FK hint to places (only to projects historically), so `place:places(...)` embeds
  // 500 with "Could not find a relationship". places.id == project_id in this schema.
  const { data: r, error: rErr } = await admin
    .from("reservations")
    .select(
      "id, reserved_at, party_size, notes, status, project_id, consumer:consumers(full_name, first_name, last_name)",
    )
    .eq("id", reservationId)
    .maybeSingle();
  if (rErr) return json({ ok: false, error: rErr.message }, 500);
  if (!r) return json({ ok: false, error: "reservation not found" }, 404);
  if (r.status !== "pending") {
    return json({ ok: true, skipped: `reservation is ${r.status}, not pending` });
  }

  // ── The number to dial: test-mode override, else the place's phone endpoint ──
  const { data: settings } = await admin
    .from("app_settings")
    .select("reservations_config")
    .eq("id", 1)
    .maybeSingle();
  const cfg = coerceReservationsCallConfig(settings?.reservations_config);

  const { data: placeRow } = await admin
    .from("places")
    .select("name, phone, products")
    .eq("id", r.project_id)
    .maybeSingle();
  const place = (placeRow ?? null) as Place | null;
  let toNumber: string | null;
  let via: string;
  if (cfg.testCall.enabled) {
    toNumber = cfg.testCall.number || null;
    via = "test-mode number";
  } else {
    const resv = (place?.products?.reservations ?? null) as
      | { channel?: string; value?: string }
      | null;
    toNumber = resv?.channel === "phone" && resv.value ? resv.value : place?.phone ?? null;
    via = "place phone endpoint";
  }

  const recordAttempt = async (status: string, conversationId: string | null) => {
    await admin
      .from("reservations")
      .update({
        // v1 = attempt 1 only; the retry scheduler (follow-up) will increment.
        call_attempts: 1,
        last_conversation_id: conversationId,
        last_called_at: new Date().toISOString(),
        last_call_status: status.slice(0, 200),
      })
      .eq("id", reservationId);
  };

  if (!toNumber) {
    await recordAttempt("no_number", null);
    return json({ ok: false, error: `no number to dial (${via})` }, 422);
  }

  // ── Resolve the agent's outbound line, then place the call ───────────────────
  const phoneRes = await resolvePhoneNumberId(key, reservationFromNumber());
  if (!phoneRes.ok) {
    await recordAttempt(`phone_unresolved: ${phoneRes.error}`, null);
    return json({ ok: false, error: phoneRes.error }, 502);
  }

  const consumer = (r.consumer ?? null) as ConsumerName | null;
  const call = await placeOutboundCall(key, {
    agentId: reservationAgentId(),
    agentPhoneNumberId: phoneRes.id,
    toNumber,
    dynamicVariables: {
      venue_name: place?.name || "el lugar",
      guest_name: guestName(consumer),
      party_size: r.party_size,
      reservation_date: esDate(r.reserved_at),
      reservation_time: esTime(r.reserved_at),
      occasion: "",
      special_requests: (r.notes ?? "").trim(),
    },
  });

  if (!call.ok) {
    await recordAttempt(`failed: ${call.error}`, null);
    return json({ ok: false, error: call.error }, 502);
  }

  await recordAttempt("placed", call.conversationId);
  return json({
    ok: true,
    conversation_id: call.conversationId,
    call_sid: call.callSid,
    dialed: toNumber,
    via,
  });
});
