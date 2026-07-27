// Supabase Edge Function — admin-web-create-test-reservation
//
// Naming: caller-verb-words. Caller = admin, verb = create, words = test-reservation.
//
// The Reservations Playground's run — on the REAL table (the sandbox is
// retired, 2026-07-27): inserts a public.reservations row flagged is_test with
// its 8-digit reference code and the per-run numbers resolved server-side,
// then hands off to supabase-edgefunc-reservation-call — the SAME engine every
// real reservation uses (ack-early; the two legs run in its background task).
//
// is_test rows are real tickets in every mechanical sense (engine, agent tool,
// admin list) but every consumer/business surface filters them out.
//
// Both sides of the call choose their number per run:
//   business_number_mode: 'test'   → config testCall.number
//                         'actual' → the place's reservation endpoint
//   consumer_number_mode: 'test'   → config testCall.consumerNumber
//                         'actual' → consumers.phone
//
// Auth: caller's JWT email must be in public.super_admins.
//
// Deploy: supabase functions deploy admin-web-create-test-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { invokeArtificialCaller } from "../_shared/internal.ts";
import { coerceReservationsCallConfig } from "../_shared/reservations-config.ts";
import { generateReservationCode, isUniqueViolation } from "../_shared/reservation-code.ts";

type NumberMode = "test" | "actual";

type Body = {
  project_id?: string;
  consumer_id?: string;
  /** Venue-local wall clock ("YYYY-MM-DDTHH:mm"), pinned to Mexico City. */
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
  const naive = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/;
  const d = new Date(naive.test(s) ? `${s}${s.length === 16 ? ":00" : ""}-06:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
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
  const notes = (body.notes ?? "").trim();

  // ── Load config + the real place and consumer this run emulates ────────────
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
  if (body.business_number_mode === "test") {
    if (!looksLikePhone(cfg.testCall.number)) {
      return json({
        ok: false,
        code: "no_business_test_number",
        error: "No valid business test number configured — set it in Reservations Config.",
      }, 422);
    }
    businessNumber = cfg.testCall.number.trim();
  } else {
    const resv = (place.products?.reservations ?? null) as
      | { channel?: string; value?: string }
      | null;
    const actual = resv?.channel === "phone" && resv.value ? resv.value : place.phone;
    if (!actual || !actual.trim()) {
      return json({
        ok: false,
        code: "place_has_no_phone",
        error: "This place has no phone endpoint — use the business test number instead.",
      }, 422);
    }
    businessNumber = actual.trim();
  }

  let consumerNumber: string;
  if (body.consumer_number_mode === "test") {
    if (!looksLikePhone(cfg.testCall.consumerNumber)) {
      return json({
        ok: false,
        code: "no_consumer_test_number",
        error: "No consumer test number configured — set it in Reservations Config.",
      }, 422);
    }
    consumerNumber = cfg.testCall.consumerNumber.trim();
  } else {
    if (!consumer.phone || !consumer.phone.trim()) {
      return json({
        ok: false,
        code: "consumer_has_no_phone",
        error: "This consumer has no phone on file — use the consumer test number instead.",
      }, 422);
    }
    consumerNumber = consumer.phone.trim();
  }

  // ── Insert the REAL row (is_test) with its reference code ──────────────────
  let ticket: { id: string } & Record<string, unknown> | null = null;
  let insErr: { message: string } | null = null;
  for (let i = 0; i < 3 && !ticket; i++) {
    const ins = await admin
      .from("reservations")
      .insert({
        consumer_id: consumer.id,
        project_id: place.id,
        is_test: true,
        reference_code: generateReservationCode(),
        reserved_at: reservedAt.toISOString(),
        party_size: partySize,
        notes: notes || null,
        status: "pending",
        business_number: businessNumber,
        consumer_number: consumerNumber,
      })
      .select("*")
      .single();
    if (!ins.error) {
      ticket = ins.data as { id: string } & Record<string, unknown>;
      insErr = null;
    } else {
      insErr = ins.error;
      if (!isUniqueViolation(ins.error)) break;
    }
  }
  if (!ticket) return json({ ok: false, error: insErr?.message ?? "insert failed" }, 500);

  // ── Same engine as production — ack-early, legs run server-side ────────────
  const call = await invokeArtificialCaller(
    envRes.env,
    "admin-web-create-test-reservation",
    "supabase-edgefunc-reservation-call",
    { reservation_id: ticket.id },
  );

  return json({
    ok: true,
    ticket: {
      ...ticket,
      place_name: place.name ?? "(unnamed place)",
      consumer_name: guestName(consumer),
    },
    call_triggered: call.ok,
    call_error: call.ok ? null : call.error,
  });
});
