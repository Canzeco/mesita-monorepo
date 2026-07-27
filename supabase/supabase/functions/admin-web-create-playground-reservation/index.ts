// Supabase Edge Function — admin-web-create-playground-reservation
//
// Naming: caller-verb-words. Caller = admin, verb = create, words = playground-reservation.
//
// The Reservations Playground's fake-user run: takes an emulated intent — a REAL
// place + a REAL consumer (both from the Mesita DB) + operator-authored intent —
// creates a SANDBOX ticket in public.playground_reservations, then places a REAL
// Reservationist call for it. Playground tickets never touch public.reservations,
// so nothing here can surface in a consumer app or count against a cap.
//
// Both sides of the call choose their number per run:
//   business_number_mode: 'test'   → config testCall.number (the business test line)
//                         'actual' → the place's real reservation endpoint
//                                    (products.reservations phone, else places.phone)
//   consumer_number_mode: 'test'   → config testCall.consumerNumber
//                         'actual' → consumers.phone
// The numbers are resolved HERE, server-side, from config + DB — the client only
// sends the modes. 'actual' on the business side rings the real venue; the
// playground UI warns before allowing it.
//
// The consumer-side number is carried into the brief as guest_phone (the callback
// number the agent can leave with the venue). The call is attempt-1-only — the
// retry scheduler never touches sandbox tickets.
//
// A ticket is created even when the call fails — the sandbox remembers every run;
// the call outcome lands on the ticket (call_status / conversation_id).
//
// Supersedes admin-web-place-reservation-test-call as the playground's trigger
// (that EF remains a bare test-line-only pipe).
//
// Auth: caller's JWT email must be in public.super_admins.
// Requires the ELEVENLABS_KEY secret; agent id + outbound line default to the
// Reservationist wiring (env-overridable), same as supabase-edgefunc-reservation-call.
//
// Deploy: supabase functions deploy admin-web-create-playground-reservation

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

type NumberMode = "test" | "actual";

type Body = {
  project_id?: string;
  consumer_id?: string;
  /**
   * Venue-local wall clock from the playground's datetime-local input
   * ("YYYY-MM-DDTHH:mm"), pinned to Mexico City below (UTC-6, DST abolished).
   * A full ISO string with an explicit offset is also accepted verbatim.
   */
  reserved_at?: string;
  party_size?: number;
  notes?: string;
  business_number_mode?: NumberMode;
  consumer_number_mode?: NumberMode;
};

function looksLikePhone(v: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(v.trim());
}

function isMode(v: unknown): v is NumberMode {
  return v === "test" || v === "actual";
}

function parseReservedAt(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  // Naive datetime-local → pin to the venue's clock (Mexico City, fixed UTC-6).
  const naive = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
  const d = new Date(naive.test(s) ? `${s}${s.length === 16 ? ":00" : ""}-06:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Spanish, Mexico-City local — the agent reads these back to the venue. Because
// parseReservedAt pinned the naive wall clock to -06:00, formatting back in
// America/Mexico_City reproduces exactly what the operator typed.
function esDate(d: Date): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(d);
  } catch {
    return d.toISOString();
  }
}
function esTime(d: Date): string {
  try {
    return new Intl.DateTimeFormat("es-MX", {
      timeZone: "America/Mexico_City",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(d);
  } catch {
    return d.toISOString();
  }
}

function guestName(c: {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
} | null): string {
  if (!c) return "el cliente";
  const full = c.full_name?.trim();
  if (full) return full;
  const joined = [c.first_name, c.last_name]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  return joined || "el cliente";
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

  if (!body.project_id || typeof body.project_id !== "string") {
    return json({ ok: false, error: "project_id required" }, 400);
  }
  if (!body.consumer_id || typeof body.consumer_id !== "string") {
    return json({ ok: false, error: "consumer_id required" }, 400);
  }
  const reservedAt = typeof body.reserved_at === "string" ? parseReservedAt(body.reserved_at) : null;
  if (!reservedAt) {
    return json({ ok: false, error: "reserved_at required (YYYY-MM-DDTHH:mm or ISO 8601)" }, 400);
  }
  const partySize = Math.trunc(Number(body.party_size));
  if (!Number.isFinite(partySize) || partySize < 1 || partySize > 50) {
    return json({ ok: false, error: "party_size must be 1..50" }, 400);
  }
  if (!isMode(body.business_number_mode)) {
    return json({ ok: false, error: "business_number_mode must be 'test' or 'actual'" }, 400);
  }
  if (!isMode(body.consumer_number_mode)) {
    return json({ ok: false, error: "consumer_number_mode must be 'test' or 'actual'" }, 400);
  }
  const businessMode = body.business_number_mode;
  const consumerMode = body.consumer_number_mode;
  const notes = (body.notes ?? "").trim();

  // ── Load config + the real place and consumer this intent emulates ─────────
  const { data: settings } = await admin
    .from("app_settings")
    .select("reservations_config")
    .eq("id", 1)
    .maybeSingle();
  const cfg = coerceReservationsCallConfig(settings?.reservations_config);

  const [placeRes, consumerRes] = await Promise.all([
    admin.from("places").select("id, name, phone, products").eq("id", body.project_id).maybeSingle(),
    admin
      .from("consumers")
      .select("id, full_name, first_name, last_name, phone")
      .eq("id", body.consumer_id)
      .maybeSingle(),
  ]);
  if (placeRes.error) return json({ ok: false, error: placeRes.error.message }, 500);
  if (!placeRes.data) return json({ ok: false, error: "place not found" }, 404);
  if (consumerRes.error) return json({ ok: false, error: consumerRes.error.message }, 500);
  if (!consumerRes.data) return json({ ok: false, error: "consumer not found" }, 404);
  const place = placeRes.data as {
    id: string;
    name: string | null;
    phone: string | null;
    products: Record<string, unknown> | null;
  };
  const consumer = consumerRes.data as {
    id: string;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  };

  // ── Resolve both numbers server-side from the chosen modes ─────────────────
  let businessNumber: string;
  if (businessMode === "test") {
    if (!looksLikePhone(cfg.testCall.number)) {
      return json(
        {
          ok: false,
          code: "no_business_test_number",
          error: "No valid business test number configured — set it in Reservations Config.",
        },
        422,
      );
    }
    businessNumber = cfg.testCall.number.trim();
  } else {
    const resv = (place.products?.reservations ?? null) as
      | { channel?: string; value?: string }
      | null;
    const actual = resv?.channel === "phone" && resv.value ? resv.value : place.phone;
    if (!actual || !actual.trim()) {
      return json(
        {
          ok: false,
          code: "place_has_no_phone",
          error: "This place has no phone endpoint — use the business test number instead.",
        },
        422,
      );
    }
    businessNumber = actual.trim();
  }

  let consumerNumber: string;
  if (consumerMode === "test") {
    if (!looksLikePhone(cfg.testCall.consumerNumber)) {
      return json(
        {
          ok: false,
          code: "no_consumer_test_number",
          error: "No consumer test number configured — set it in Reservations Config.",
        },
        422,
      );
    }
    consumerNumber = cfg.testCall.consumerNumber.trim();
  } else {
    if (!consumer.phone || !consumer.phone.trim()) {
      return json(
        {
          ok: false,
          code: "consumer_has_no_phone",
          error: "This consumer has no phone on file — use the consumer test number instead.",
        },
        422,
      );
    }
    consumerNumber = consumer.phone.trim();
  }

  // ── Create the sandbox ticket (remembered even if the call fails) ──────────
  const { data: ticket, error: insErr } = await admin
    .from("playground_reservations")
    .insert({
      created_by: authRes.user.id,
      project_id: place.id,
      place_name: place.name ?? "(unnamed place)",
      consumer_id: consumer.id,
      consumer_name: guestName(consumer),
      reserved_at: reservedAt.toISOString(),
      party_size: partySize,
      notes: notes || null,
      status: "pending",
      business_number_mode: businessMode,
      business_number: businessNumber,
      consumer_number_mode: consumerMode,
      consumer_number: consumerNumber,
    })
    .select("*")
    .single();
  if (insErr) return json({ ok: false, error: insErr.message }, 500);

  const recordCall = async (status: string, conversationId: string | null) => {
    const { data } = await admin
      .from("playground_reservations")
      .update({
        call_status: status.slice(0, 200),
        conversation_id: conversationId,
        called_at: new Date().toISOString(),
      })
      .eq("id", ticket.id)
      .select("*")
      .single();
    return data ?? { ...ticket, call_status: status.slice(0, 200), conversation_id: conversationId };
  };

  // ── Place the real call. Failures are DATA on the ticket, not request errors:
  //    the run happened and the sandbox remembers it. ──────────────────────────
  const key = elevenLabsKey();
  if (!key) {
    const t = await recordCall("no ELEVENLABS_KEY", null);
    return json({ ok: true, ticket: t, call: { ok: false, error: "ELEVENLABS_KEY not configured" } });
  }

  const phoneRes = await resolvePhoneNumberId(key, reservationFromNumber());
  if (!phoneRes.ok) {
    const t = await recordCall(`failed: ${phoneRes.error}`, null);
    return json({ ok: true, ticket: t, call: { ok: false, error: phoneRes.error } });
  }

  const call = await placeOutboundCall(key, {
    agentId: reservationAgentId(),
    agentPhoneNumberId: phoneRes.id,
    toNumber: businessNumber,
    dynamicVariables: {
      venue_name: place.name?.trim() || "el lugar",
      guest_name: guestName(consumer),
      guest_phone: consumerNumber,
      party_size: partySize,
      reservation_date: esDate(reservedAt),
      reservation_time: esTime(reservedAt),
      occasion: "",
      special_requests: notes,
    },
  });

  if (!call.ok) {
    const t = await recordCall(`failed: ${call.error}`, null);
    return json({ ok: true, ticket: t, call: { ok: false, error: call.error } });
  }

  const t = await recordCall("placed", call.conversationId);
  return json({
    ok: true,
    ticket: t,
    call: { ok: true, conversation_id: call.conversationId, dialed: businessNumber },
  });
});
