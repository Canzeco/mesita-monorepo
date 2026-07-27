// Supabase Edge Function — admin-web-create-playground-reservation
//
// Naming: caller-verb-words. Caller = admin, verb = create, words = playground-reservation.
//
// The Reservations Playground's fake-user run, ticket-first: takes an emulated
// intent — a REAL place + a REAL consumer (both from the Mesita DB) + operator-
// authored intent — inserts a SANDBOX ticket in public.playground_reservations
// and responds IMMEDIATELY. Then, in an EdgeRuntime background task (the
// enricher's ack-early pattern), the TWO-LEG agent run fires:
//
//   Leg 1 · consumer → business  up to reservations_config.attempts call
//     intents — the agent calls the venue ON BEHALF OF the guest; no answer →
//     next intent. Once answered, we watch the conversation to its post-call
//     analysis: call_successful=success → the venue CONFIRMED.
//   Leg 2 · business → consumer  ONLY after a confirmation, the agent calls
//     the human guest back to confirm the reservation (callback_* columns).
//     Declined / unreachable / unresolved runs skip it.
//
// Both legs carry per-leg briefs (prompt + first message overrides, with a
// vars-only fallback) that include the hang-up policy: the agent ends the
// call itself once the outcome is settled — see _shared/reservation-legs.ts.
// Every intent lands in the ticket's `attempts` log; `attempts_state` tells
// the sandbox UI when the loop is done and `status` carries the verdict
// (pending → confirmed | declined | unresolved | unreachable | error).
// Playground tickets never touch public.reservations.
//
// Playground intents are spaced SECONDS apart on purpose — production's
// attempts 2..N wait for the venue's opening hours (that scheduler is the
// production follow-up; this loop is its compressed test double).
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
// The consumer-side number is carried into the brief as guest_phone (the
// callback number the agent can leave with the venue).
//
// Auth: caller's JWT email must be in public.super_admins.
// Requires the ELEVENLABS_KEY secret; agent id + outbound line default to the
// Reservationist wiring (env-overridable), same as supabase-edgefunc-reservation-call.
//
// Deploy: supabase functions deploy admin-web-create-playground-reservation

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { coerceReservationsCallConfig } from "../_shared/reservations-config.ts";
import { generateReservationCode, isUniqueViolation } from "../_shared/reservation-code.ts";
import {
  elevenLabsKey,
  getConversationStatus,
  placeOutboundCall,
  reservationAgentId,
  reservationFromNumber,
  resolvePhoneNumberId,
} from "../_shared/elevenlabs.ts";
import {
  businessLegFirstMessage,
  businessLegPrompt,
  guestLegFirstMessage,
  guestLegPrompt,
  legDynamicVariables,
  type ReservationLegVars,
} from "../_shared/reservation-legs.ts";

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

// ── Run pacing ───────────────────────────────────────────────────────────────
// Both legs run inside ONE background task, under the edge-runtime ~400s wall:
//   leg 1: per intent, poll every WATCH_POLL_MS within ANSWER_BUDGET_MS for
//     answered/no-answer (an unanswered Twilio leg lands 'failed' well inside
//     it), RETRY_GAP_MS between intents; once answered, up to VERDICT_BUDGET_MS
//     more for the post-call analysis (call duration + processing).
//   leg 2: one guest call, CALLBACK_BUDGET_MS to see it answered.
// Worst case (3 intents, answered on the last): 2×(60+8) + 60 + 130 + 60 ≈ 386s.
const WATCH_POLL_MS = 8_000;
const ANSWER_BUDGET_MS = 60_000;
const VERDICT_BUDGET_MS = 130_000;
const CALLBACK_BUDGET_MS = 60_000;
const RETRY_GAP_MS = 8_000;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Ack-early background task — mirror of runInBackground in
// _shared/enrich-pipeline.ts (not imported: that module drags the whole
// enrichment stage machinery into the bundle).
function runInBackground(task: Promise<unknown>): void {
  const edgeRuntime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
  else void task;
}

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

type AttemptEntry = {
  n: number;
  started_at: string;
  conversation_id: string | null;
  result: string;
};

// Watch one placed call until we can tell whether it was answered.
//   'answered'  — the conversation connected (in-progress / processing / done)
//   'no_answer' — ElevenLabs marked it failed (unanswered/declined Twilio leg)
//   'unknown'   — budget expired without a verdict (we stop; never double-call
//                 a line that might be mid-conversation)
async function watchUntilAnswered(
  key: string,
  conversationId: string,
  budgetMs: number,
): Promise<"answered" | "no_answer" | "unknown"> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    await delay(WATCH_POLL_MS);
    const s = await getConversationStatus(key, conversationId);
    if (!s.ok) continue; // transient fetch trouble — keep watching until budget
    if (s.status === "failed") return "no_answer";
    if (s.status === "in-progress" || s.status === "processing" || s.status === "done") {
      return "answered";
    }
    // 'initiated' (still ringing) or anything unrecognised → keep watching.
  }
  return "unknown";
}

// After the venue answered, keep watching to the post-call analysis: did it
// CONFIRM the reservation? (analysis.call_successful on the done conversation —
// the agent's success criterion is "reservation confirmed".)
async function watchVerdict(
  key: string,
  conversationId: string,
): Promise<"confirmed" | "declined" | "unknown"> {
  const deadline = Date.now() + VERDICT_BUDGET_MS;
  while (Date.now() < deadline) {
    await delay(WATCH_POLL_MS);
    const s = await getConversationStatus(key, conversationId);
    if (!s.ok) continue;
    if (s.status === "done") {
      if (s.callSuccessful === "success") return "confirmed";
      if (s.callSuccessful === "failure") return "declined";
      return "unknown";
    }
    if (s.status === "failed") return "unknown"; // dropped mid-call — no verdict
  }
  return "unknown";
}

// The two-leg run — fires AFTER the HTTP response, updating the ticket as it
// goes so the sandbox shows live progress.
async function runIntents(input: {
  admin: SupabaseClient;
  ticketId: string;
  attemptsPlanned: number;
  businessNumber: string;
  consumerNumber: string;
  legVars: ReservationLegVars;
}): Promise<void> {
  const { admin, ticketId, attemptsPlanned, legVars } = input;
  const attempts: AttemptEntry[] = [];
  const record = async (patch: Record<string, unknown>) => {
    await admin.from("playground_reservations").update(patch).eq("id", ticketId);
  };

  // Leg 2 · business → consumer — the confirmation call to the human. Reached
  // ONLY after leg 1 lands a confirmation (callback_state is already 'calling',
  // written atomically with status='confirmed' so the UI never sees a gap).
  const callGuest = async (key: string, phoneNumberId: string): Promise<void> => {
    const call = await placeOutboundCall(key, {
      agentId: reservationAgentId(),
      agentPhoneNumberId: phoneNumberId,
      toNumber: input.consumerNumber,
      dynamicVariables: legDynamicVariables("guest_confirmation", legVars),
      overrides: {
        prompt: guestLegPrompt(legVars),
        firstMessage: guestLegFirstMessage(legVars),
        language: "es",
      },
    });
    if (!call.ok) {
      await record({
        callback_state: "failed",
        call_status: `confirmed — guest call failed: ${call.error}`.slice(0, 200),
      });
      return;
    }
    await record({
      callback_state: "ringing",
      callback_conversation_id: call.conversationId,
      call_status: "confirmed — calling the guest",
    });
    const outcome = call.conversationId
      ? await watchUntilAnswered(key, call.conversationId, CALLBACK_BUDGET_MS)
      : "unknown";
    await record({
      callback_state: outcome,
      call_status: outcome === "answered"
        ? "confirmed — guest notified"
        : outcome === "no_answer"
        ? "confirmed — guest didn't answer"
        : "confirmed — guest call outcome unknown",
    });
  };

  try {
    const key = elevenLabsKey();
    if (!key) {
      await record({
        attempts_state: "error",
        status: "error",
        callback_state: "skipped",
        call_status: "no ELEVENLABS_KEY",
      });
      return;
    }
    const phoneRes = await resolvePhoneNumberId(key, reservationFromNumber());
    if (!phoneRes.ok) {
      await record({
        attempts_state: "error",
        status: "error",
        callback_state: "skipped",
        call_status: `failed: ${phoneRes.error}`.slice(0, 200),
      });
      return;
    }

    // Leg 1 · consumer → business — the booking intents.
    for (let n = 1; n <= attemptsPlanned; n++) {
      const entry: AttemptEntry = {
        n,
        started_at: new Date().toISOString(),
        conversation_id: null,
        result: "dialing",
      };
      attempts.push(entry);
      await record({
        attempts,
        call_attempts: n,
        called_at: entry.started_at,
        call_status: `intent ${n}: dialing`,
      });

      const call = await placeOutboundCall(key, {
        agentId: reservationAgentId(),
        agentPhoneNumberId: phoneRes.id,
        toNumber: input.businessNumber,
        dynamicVariables: legDynamicVariables("business_booking", legVars),
        overrides: {
          prompt: businessLegPrompt(legVars),
          firstMessage: businessLegFirstMessage(legVars),
          language: "es",
        },
      });

      if (!call.ok) {
        entry.result = `placement failed: ${call.error}`.slice(0, 160);
        await record({
          attempts,
          call_status: `intent ${n} failed: ${call.error}`.slice(0, 200),
        });
        if (n < attemptsPlanned) await delay(RETRY_GAP_MS);
        continue;
      }

      entry.conversation_id = call.conversationId;
      entry.result = "ringing";
      await record({
        attempts,
        conversation_id: call.conversationId,
        call_status: `intent ${n}: ringing`,
      });

      const outcome = call.conversationId
        ? await watchUntilAnswered(key, call.conversationId, ANSWER_BUDGET_MS)
        : "unknown";

      if (outcome === "no_answer") {
        entry.result = "no_answer";
        await record({ attempts, call_status: `intent ${n}: no answer` });
        if (n < attemptsPlanned) await delay(RETRY_GAP_MS);
        continue;
      }
      if (outcome === "unknown") {
        // Can't tell — the line may be mid-conversation. Stop rather than risk
        // ringing it again on top of a live call.
        entry.result = "unknown";
        await record({
          attempts,
          attempts_state: "exhausted",
          status: "unresolved",
          callback_state: "skipped",
          call_status: `intent ${n}: outcome unknown — not retrying`,
        });
        return;
      }

      // Answered — now wait for the venue's VERDICT before anything else.
      entry.result = "answered";
      await record({ attempts, call_status: `intent ${n}: answered — awaiting verdict` });
      const verdict = call.conversationId
        ? await watchVerdict(key, call.conversationId)
        : "unknown";

      if (verdict === "confirmed") {
        entry.result = "confirmed";
        await record({
          attempts,
          attempts_state: "answered",
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
          callback_state: "calling",
          callback_at: new Date().toISOString(),
          call_status: `intent ${n}: venue confirmed — calling the guest`,
        });
        await callGuest(key, phoneRes.id);
        return;
      }
      if (verdict === "declined") {
        // The venue ANSWERED and said no — terminal. Re-dialing would re-ask
        // a venue that already declined.
        entry.result = "declined";
        await record({
          attempts,
          attempts_state: "answered",
          status: "declined",
          callback_state: "skipped",
          call_status: `intent ${n}: venue declined — no guest call`,
        });
        return;
      }
      entry.result = "unresolved";
      await record({
        attempts,
        attempts_state: "answered",
        status: "unresolved",
        callback_state: "skipped",
        call_status: `intent ${n}: answered, verdict unknown — no guest call`,
      });
      return;
    }

    await record({
      attempts_state: "exhausted",
      status: "unreachable",
      callback_state: "skipped",
      call_status: `no answer after ${attemptsPlanned} intent${attemptsPlanned === 1 ? "" : "s"}`,
    });
  } catch (e) {
    await record({
      attempts_state: "error",
      status: "error",
      callback_state: "skipped",
      call_status: `failed: ${e instanceof Error ? e.message : "run crashed"}`.slice(0, 200),
    });
  }
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

  // ── The ticket is created IMMEDIATELY, with its 8-digit reference code ─────
  // (fresh code per try; a unique-index collision just redraws).
  let ticket: { id: string } & Record<string, unknown> | null = null;
  let insErr: { message: string } | null = null;
  let referenceCode = "";
  for (let i = 0; i < 3 && !ticket; i++) {
    referenceCode = generateReservationCode();
    const ins = await admin
      .from("playground_reservations")
      .insert({
        created_by: authRes.user.id,
        project_id: place.id,
        place_name: place.name ?? "(unnamed place)",
        consumer_id: consumer.id,
        consumer_name: guestName(consumer),
        reference_code: referenceCode,
        reserved_at: reservedAt.toISOString(),
        party_size: partySize,
        notes: notes || null,
        status: "pending",
        business_number_mode: businessMode,
        business_number: businessNumber,
        consumer_number_mode: consumerMode,
        consumer_number: consumerNumber,
        attempts: [],
        attempts_planned: cfg.attempts,
        attempts_state: "running",
        callback_state: "none",
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

  // ── … and then the intents start (background — the response doesn't wait). ─
  runInBackground(
    runIntents({
      admin,
      ticketId: ticket.id,
      attemptsPlanned: cfg.attempts,
      businessNumber,
      consumerNumber,
      legVars: {
        venueName: place.name?.trim() || "el lugar",
        guestName: guestName(consumer),
        guestPhone: consumerNumber,
        referenceCode,
        partySize,
        dateEs: esDate(reservedAt),
        timeEs: esTime(reservedAt),
        specialRequests: notes,
      },
    }),
  );

  return json({ ok: true, ticket });
});
