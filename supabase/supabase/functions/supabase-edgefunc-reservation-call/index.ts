// Supabase Edge Function — supabase-edgefunc-reservation-call (internal / artificial caller)
//
// THE Reservationist call engine — the sandbox is retired (2026-07-27) and the
// full two-leg run now executes on public.reservations for EVERY ticket, real
// or is_test. Invoked with { reservation_id } by:
//   · consumer-web-create-reservation  (real guest tapped Reserve)
//   · consumer-mcp                     (assistant-created reservation)
//   · admin-web-create-test-reservation (operator Playground run, is_test rows)
//
// ACK-EARLY: validates + marks attempts_state='running', then the legs run in
// an EdgeRuntime background task and the response returns immediately — the
// creator EFs never block on a phone call.
//
//   Leg 1 · consumer → business  up to ATTEMPTS (fixed 2) call intents — the
//     agent calls the venue ON BEHALF OF the guest; no answer → next intent.
//     Once answered, watch the conversation to its post-call analysis:
//     call_successful=success → the venue CONFIRMED.
//   Leg 2 · business → consumer  ONLY after a confirmation, the agent calls
//     the human guest back to confirm (callback_* columns). Skipped when the
//     ticket has no guest number.
//
// Intents are spaced SECONDS apart still — the open-hours-aware scheduler
// (+5 min if open, else 30 min after next opening) is the production
// follow-up; this loop is its compressed version.
//
// Number resolution, per side:
//   business — reservations.business_number when pre-resolved (test tickets),
//     else config testCall (test mode defaults ON → never rings a real venue
//     by accident), else the place's products.reservations phone endpoint.
//   consumer — reservations.consumer_number when pre-resolved, else the
//     consumer's own phone; empty → leg 2 is skipped.
//
// Status transitions (reservation_status enum): pending → confirmed |
// declined | unreachable | unresolved. Engine crashes leave status alone and
// park attempts_state='error' with the reason in last_call_status.
//
// Auth: verify_jwt = true + requireInternalCaller — internal callers only.
//
// Deploy: supabase functions deploy supabase-edgefunc-reservation-call

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { coerceReservationsCallConfig } from "../_shared/reservations-config.ts";
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

type Body = { reservation_id?: string };

// ── Run pacing — one background task under the edge-runtime ~400s wall ───────
const WATCH_POLL_MS = 8_000;
const ANSWER_BUDGET_MS = 60_000;
const VERDICT_BUDGET_MS = 130_000;
const CALLBACK_BUDGET_MS = 60_000;
const RETRY_GAP_MS = 8_000;

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Ack-early background task — mirror of runInBackground in
// _shared/enrich-pipeline.ts (not imported: it drags the enrichment stages in).
function runInBackground(task: Promise<unknown>): void {
  const edgeRuntime = (globalThis as unknown as {
    EdgeRuntime?: { waitUntil?: (p: Promise<unknown>) => void };
  }).EdgeRuntime;
  if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(task);
  else void task;
}

type ConsumerName = {
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
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

// Spanish, Mexico-City local — the agent reads these back on the call.
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

type AttemptEntry = {
  n: number;
  started_at: string;
  conversation_id: string | null;
  result: string;
};

// Watch one placed call until we can tell whether it was answered.
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
  }
  return "unknown";
}

// After the venue answered, wait for the post-call verdict.
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
// goes so every surface (admin tickets list, consumer app) shows live progress.
async function runIntents(input: {
  admin: SupabaseClient;
  reservationId: string;
  attemptsPlanned: number;
  businessNumber: string;
  consumerNumber: string; // "" = no guest number → leg 2 skipped
  legVars: ReservationLegVars;
}): Promise<void> {
  const { admin, reservationId, attemptsPlanned, legVars } = input;
  const attempts: AttemptEntry[] = [];
  const record = async (patch: Record<string, unknown>) => {
    await admin.from("reservations").update(patch).eq("id", reservationId);
  };

  // Leg 2 · business → consumer — the confirmation call to the human.
  const callGuest = async (key: string, phoneNumberId: string): Promise<void> => {
    if (!input.consumerNumber) {
      await record({
        callback_state: "skipped",
        last_call_status: "confirmed — no guest number for the callback",
      });
      return;
    }
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
        last_call_status: `confirmed — guest call failed: ${call.error}`.slice(0, 200),
      });
      return;
    }
    await record({
      callback_state: "ringing",
      callback_conversation_id: call.conversationId,
      last_call_status: "confirmed — calling the guest",
    });
    const outcome = call.conversationId
      ? await watchUntilAnswered(key, call.conversationId, CALLBACK_BUDGET_MS)
      : "unknown";
    await record({
      callback_state: outcome,
      last_call_status: outcome === "answered"
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
        callback_state: "skipped",
        last_call_status: "no ELEVENLABS_KEY",
      });
      return;
    }
    const phoneRes = await resolvePhoneNumberId(key, reservationFromNumber());
    if (!phoneRes.ok) {
      await record({
        attempts_state: "error",
        callback_state: "skipped",
        last_call_status: `failed: ${phoneRes.error}`.slice(0, 200),
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
        last_called_at: entry.started_at,
        last_call_status: `intent ${n}: dialing`,
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
          last_call_status: `intent ${n} failed: ${call.error}`.slice(0, 200),
        });
        if (n < attemptsPlanned) await delay(RETRY_GAP_MS);
        continue;
      }

      entry.conversation_id = call.conversationId;
      entry.result = "ringing";
      await record({
        attempts,
        last_conversation_id: call.conversationId,
        last_call_status: `intent ${n}: ringing`,
      });

      const outcome = call.conversationId
        ? await watchUntilAnswered(key, call.conversationId, ANSWER_BUDGET_MS)
        : "unknown";

      if (outcome === "no_answer") {
        entry.result = "no_answer";
        await record({ attempts, last_call_status: `intent ${n}: no answer` });
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
          last_call_status: `intent ${n}: outcome unknown — not retrying`,
        });
        return;
      }

      // Answered — wait for the venue's VERDICT before anything else.
      entry.result = "answered";
      await record({
        attempts,
        last_call_status: `intent ${n}: answered — awaiting verdict`,
      });
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
          last_call_status: `intent ${n}: venue confirmed — calling the guest`,
        });
        await callGuest(key, phoneRes.id);
        return;
      }
      if (verdict === "declined") {
        // The venue ANSWERED and said no — terminal.
        entry.result = "declined";
        await record({
          attempts,
          attempts_state: "answered",
          status: "declined",
          callback_state: "skipped",
          last_call_status: `intent ${n}: venue declined — no guest call`,
        });
        return;
      }
      entry.result = "unresolved";
      await record({
        attempts,
        attempts_state: "answered",
        status: "unresolved",
        callback_state: "skipped",
        last_call_status: `intent ${n}: answered, verdict unknown — no guest call`,
      });
      return;
    }

    await record({
      attempts_state: "exhausted",
      status: "unreachable",
      callback_state: "skipped",
      last_call_status: `no answer after ${attemptsPlanned} intent${
        attemptsPlanned === 1 ? "" : "s"
      }`,
    });
  } catch (e) {
    await record({
      attempts_state: "error",
      callback_state: "skipped",
      last_call_status: `failed: ${e instanceof Error ? e.message : "run crashed"}`.slice(0, 200),
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
  const authRes = requireInternalCaller(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const reservationId = bodyRes.body.reservation_id;
  if (!reservationId || typeof reservationId !== "string") {
    return json({ ok: false, error: "reservation_id required" }, 400);
  }

  if (!elevenLabsKey()) {
    return json({ ok: false, error: "ELEVENLABS_KEY not configured" }, 503);
  }

  const admin = adminClient(envRes.env);

  // Fetch place by project_id separately — reservations.project_id has no
  // PostgREST FK hint to places, so an embed 500s. places.id == project_id.
  const { data: r, error: rErr } = await admin
    .from("reservations")
    .select(
      "id, reference_code, reserved_at, party_size, notes, status, project_id, is_test, business_number, consumer_number, attempts_state, consumer:consumers(full_name, first_name, last_name, phone)",
    )
    .eq("id", reservationId)
    .maybeSingle();
  if (rErr) return json({ ok: false, error: rErr.message }, 500);
  if (!r) return json({ ok: false, error: "reservation not found" }, 404);
  if (r.status !== "pending") {
    return json({ ok: true, skipped: `reservation is ${r.status}, not pending` });
  }
  if (r.attempts_state === "running") {
    return json({ ok: true, skipped: "intents already running" });
  }

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
  const place = (placeRow ?? null) as {
    name?: string | null;
    phone?: string | null;
    products?: Record<string, unknown> | null;
  } | null;

  // ── Resolve the business number: row override → test mode → place endpoint ─
  let businessNumber = (r.business_number ?? "").trim();
  let via = "row";
  if (!businessNumber) {
    if (cfg.testCall.enabled) {
      businessNumber = cfg.testCall.number;
      via = "test-mode number";
    } else {
      const resv = (place?.products?.reservations ?? null) as
        | { channel?: string; value?: string }
        | null;
      businessNumber =
        (resv?.channel === "phone" && resv.value ? resv.value : place?.phone ?? "")?.trim() ?? "";
      via = "place phone endpoint";
    }
  }
  if (!businessNumber) {
    await admin
      .from("reservations")
      .update({ attempts_state: "error", last_call_status: `no number to dial (${via})` })
      .eq("id", reservationId);
    return json({ ok: false, error: `no number to dial (${via})` }, 422);
  }

  const consumer = (r.consumer ?? null) as ConsumerName | null;
  const consumerNumber = (r.consumer_number ?? consumer?.phone ?? "").trim();

  // Mark running + persist the resolved numbers, then ack — the legs continue
  // in the background task.
  await admin
    .from("reservations")
    .update({
      attempts_state: "running",
      attempts_planned: cfg.attempts,
      business_number: businessNumber,
      consumer_number: consumerNumber || null,
    })
    .eq("id", reservationId);

  runInBackground(
    runIntents({
      admin,
      reservationId,
      attemptsPlanned: cfg.attempts,
      businessNumber,
      consumerNumber,
      legVars: {
        venueName: place?.name?.trim() || "el lugar",
        guestName: guestName(consumer),
        guestPhone: consumerNumber,
        referenceCode: (r.reference_code ?? "").trim(),
        partySize: r.party_size,
        dateEs: esDate(r.reserved_at),
        timeEs: esTime(r.reserved_at),
        specialRequests: (r.notes ?? "").trim(),
      },
    }),
  );

  return json({
    ok: true,
    started: true,
    reservation_id: reservationId,
    dialed: businessNumber,
    via,
  });
});
