// Supabase Edge Function — admin-web-place-reservation-test-call
//
// Naming: caller-verb-words. Caller = admin, verb = place, words = reservation-test-call.
//
// The Reservations Playground's "Fake user" mode: places a REAL outbound
// Reservationist call from the admin console WITHOUT creating a reservation row.
// It ALWAYS dials the configured test number (app_settings.reservations_config
// .testCall.number) — never a place's real line. The caller supplies only the
// booking variables the agent reads back (guest, party, date/time, venue name,
// notes); the number to dial is resolved here, from config, so this endpoint can
// never ring a real venue no matter what the client sends.
//
// This is the "it actually works" path: it spends ElevenLabs/Twilio budget and
// returns the live conversation_id, unlike the dry-run brief preview.
//
// Auth: caller's JWT email must be in public.super_admins.
// Requires the ELEVENLABS_KEY secret; agent id + outbound line default to the
// Reservationist wiring (env-overridable), same as supabase-edgefunc-reservation-call.
//
// Deploy: supabase functions deploy admin-web-place-reservation-test-call

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { coerceReservationsCallConfig } from "../_shared/reservations-config.ts";
import {
  elevenLabsKey,
  placeOutboundCall,
  reservationAgentId,
  reservationFromNumber,
  resolvePhoneNumberId,
} from "../_shared/elevenlabs.ts";

type Body = {
  guest_name?: string;
  party_size?: number;
  venue_name?: string;
  notes?: string;
  // Already es-MX formatted by the playground (it echoes the wall-clock the
  // operator typed, treating it as Mexico-City local — see the playground's
  // esDate/esTime). We pass these through verbatim so the agent reads back
  // exactly what the operator previews. Empty string = nothing entered.
  reservation_date?: string;
  reservation_time?: string;
};

// A leading + and 8–15 digits. Mirrors looksLikePhone in the admin catalog and
// normalizeConfig — the real validity check is placing the call.
function looksLikePhone(v: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(v.trim());
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  const key = elevenLabsKey();
  if (!key) return json({ ok: false, error: "ELEVENLABS_KEY not configured" }, 503);

  // ── The number to dial: ALWAYS the configured test number, never a venue ──
  // Resolved here (not from the client) so this endpoint is structurally
  // incapable of ringing a real place.
  const { data: settings } = await admin
    .from("app_settings")
    .select("reservations_config")
    .eq("id", 1)
    .maybeSingle();
  const cfg = coerceReservationsCallConfig(settings?.reservations_config);
  const toNumber = cfg.testCall.number.trim();
  if (!looksLikePhone(toNumber)) {
    return json(
      {
        ok: false,
        code: "no_test_number",
        error:
          "No valid test number is configured. Set an E.164 test number in Reservations Config first.",
      },
      422,
    );
  }

  // ── Resolve the agent's outbound line, then place the call ───────────────────
  const phoneRes = await resolvePhoneNumberId(key, reservationFromNumber());
  if (!phoneRes.ok) return json({ ok: false, error: phoneRes.error }, 502);

  const partyRaw = Number(body.party_size);
  const partySize = Number.isFinite(partyRaw)
    ? Math.max(1, Math.min(50, Math.trunc(partyRaw)))
    : 2;

  const call = await placeOutboundCall(key, {
    agentId: reservationAgentId(),
    agentPhoneNumberId: phoneRes.id,
    toNumber,
    dynamicVariables: {
      // The config-tab smoke call is always leg 1 (consumer → business); no
      // guest number rides along, so guest_phone stays empty.
      call_direction: "business_booking",
      venue_name: str(body.venue_name) || "el lugar",
      guest_name: str(body.guest_name) || "el cliente",
      guest_phone: "",
      party_size: partySize,
      reservation_date: str(body.reservation_date),
      reservation_time: str(body.reservation_time),
      occasion: "",
      special_requests: str(body.notes),
    },
  });

  if (!call.ok) return json({ ok: false, error: call.error }, 502);

  return json({
    ok: true,
    conversation_id: call.conversationId,
    call_sid: call.callSid,
    dialed: toNumber,
    via: "test-mode number",
  });
});
