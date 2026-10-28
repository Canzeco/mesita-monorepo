// Supabase Edge Function — supabase-edgefunc-reservation-call (internal)
//
// THE Reservationist call engine — the sandbox AND the admin Playground are
// retired (2026-07-27): every ticket is a real public.reservation_tickets row and
// testing happens through the consumer app with config testCall mode ON (the
// place leg dials the test line instead of a real place). Invoked with
// { reservation_id } by:
//   · consumer-web-create-reservation  (guest tapped Reserve)
//   · eleven-a2-confirm-reservation    (negotiation re-fire: the guest picked
//     an alternative or proposed a new datetime → fresh Booker call)
//
// ACK-EARLY: validates + marks attempts_state='running', then the legs run in
// an EdgeRuntime background task and the response returns immediately — the
// creator EFs never block on a phone call.
//
//   Leg 1 · consumer → business  up to ATTEMPTS (fixed 2) call intents — the
//     agent calls the place ON BEHALF OF the guest; no answer → next intent.
//     Once answered, the verdict: what a1 RECORDED via a1_report_outcome
//     (confirmed / counter_offer + alternatives / declined) outranks the
//     post-call analysis heuristic (call_successful=success → CONFIRMED).
//   Leg 2 · business → consumer  after a confirmation (call_context
//     "confirmation") OR a counter-offer (call_context "counter_offer", the
//     alternatives ride venue_alternatives) the agent calls the human guest
//     (callback_* columns). Skipped when the ticket has no guest number. On a
//     counter-offer the ticket STAYS pending — the guest's pick lands through
//     eleven-a2-confirm-reservation, which re-fires this engine (≤2 rounds).
//
// RETRIES ARE OPEN-HOURS AWARE (no longer seconds apart): a no-answer parks
// the ticket with attempts_state='scheduled' + next_attempt_at — +5 min if the
// place is open right now, else ~30 min after it next opens — and
// supabase-cron-reservation-retries wakes it. A run therefore places ONE call
// and returns; the run that resumes reads call_attempts and continues the
// sequence. See _shared/reservation-retry.ts.
//
// Number resolution, per side:
//   business — reservations.place_phone when pre-resolved (test tickets),
//     else config testCall (test mode defaults ON → never rings a real place
//     by accident), else place_profiles.reservation_target when the channel is phone (MESITA-842 —
//     voice-only; whatsapp/instagram picks ignored → place_profiles.phone fallback).
//   consumer — reservations.consumer_phone when pre-resolved, else the
//     consumer's own phone; empty → leg 2 is skipped.
//
// And per LINE: leg 1 dials FROM the place-facing line, leg 2 FROM the
// guest-facing one, so each side saves a different caller ID and a callback
// reaches the right inbound agent (a4 for places, a3 for guests) without a
// caller-ID lookup. An unresolvable consumer line degrades to the business
// line rather than dropping a reservation that may already be confirmed.
//
// State transitions (reservation_state enum): pending → confirmed |
// declined | unreachable | unresolved. Engine crashes leave state alone and
// park attempts_state='error' with the reason in last_call_state. Every
// verdict the guest must hear about — those four, plus a counter-offer —
// also writes a Me › Notifications row (_shared/reservation-notification.ts).
//
// Auth: verify_jwt = true + requireInternalCaller — internal callers only.
//
// Layout: this file validates, gates, resolves numbers and claims the ticket
// (one launch<Intent> per errand); legs.ts holds the background leg runners.
//
// Deploy: supabase functions deploy supabase-edgefunc-reservation-call

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { requireInternalCaller } from "../_shared/internal.ts";
import { runInBackground } from "../_shared/background.ts";
import {
  ATTEMPTS,
  coerceReservationsCallConfig,
  type ReservationsCallConfig,
} from "../_shared/reservations-config.ts";
import { reservationAgentId, resolveElevenLabsKey } from "../_shared/elevenlabs.ts";
import { alternativesToSpeech, normalizeAlternatives } from "../_shared/reservation-alternatives.ts";
import type { ReservationLegVars } from "../_shared/reservation-legs.ts";
import {
  type ReservationAttempt,
  type ReservationPatch,
  validateReservationPatch,
  writeReservation,
} from "../_shared/reservation-doc.ts";
import { rowPlaceId } from "../_shared/place-id.ts";
import { notifyReservationOutcome } from "../_shared/reservation-notification.ts";
import { esDate, esTime } from "../_shared/es-speak.ts";
import { guestName, type GuestNameParts } from "../_shared/reservation-guest-name.ts";
import { runCallbackRetry, runCancelNotice, runIntents, runReminder } from "./legs.ts";

// intent: "book" (default) = the two-leg booking run · "callback_retry" =
// re-ring the guest on a still-live verdict (leg 3) · "cancel_notice" = tell
// the side that DIDN'T cancel (legs 5/6, notice_kind picks a1-place/a2-guest).
type Body = { reservation_id?: string; intent?: string };
type Intent = "book" | "callback_retry" | "cancel_notice" | "reminder";

type ConsumerName = GuestNameParts & { phone?: string | null };

type PlaceRow = {
  name?: string | null;
  photos?: unknown;
  phone?: string | null;
  reservation_channel?: string | null;
  reservation_target?: string | null;
  hours?: unknown;
  lng?: number | null;
};

/** The ticket columns the launchers read (the handler's select). */
type TicketRow = {
  consumer_id: string;
  reference_code: string | null;
  reserved_at: string;
  state: string;
  notice_kind: string | null;
  notice_attempts: unknown;
  callback_attempts: unknown;
  call_attempts: unknown;
  outage_retries: unknown;
  attempts: unknown;
  alternatives: unknown;
};

/** Everything the handler resolved before an intent claims its ticket. */
type LaunchCtx = {
  admin: SupabaseClient;
  reservationId: string;
  r: TicketRow;
  intent: Intent;
  elevenKey: string;
  cfg: ReservationsCallConfig;
  place: PlaceRow | null;
  placeId: string;
  placeLng: number | null;
  businessNumber: string;
  via: string;
  consumerNumber: string;
  bookerAgentId: string;
  confirmerAgentId: string;
  guestNotify: "call" | "app";
  runId: string;
  modificationOfIso: string | null;
  legVars: ReservationLegVars;
};

// Legs 5/6 · claim the owed cancellation notice, then ring the side that
// didn't cancel in the background.
async function launchCancelNotice(ctx: LaunchCtx): Promise<Response> {
  const {
    admin,
    reservationId,
    r,
    intent,
    elevenKey,
    cfg,
    place,
    placeId,
    placeLng,
    businessNumber,
    consumerNumber,
    bookerAgentId,
    confirmerAgentId,
    guestNotify,
    runId,
    modificationOfIso,
    legVars,
  } = ctx;
  const kind = r.notice_kind as "place_cancel" | "guest_cancel";
  const toNumber = kind === "place_cancel" ? businessNumber : consumerNumber;
  if (!toNumber) {
    await writeReservation(admin, {
      mode: "update",
      id: reservationId,
      patch: {
        notice_state: "failed",
        last_call_state: `cancel notice (${kind}) — no number to dial`,
      },
    });
    return json({ ok: false, error: "no number to dial for the notice" }, 422);
  }
  // Claim it compare-and-swap style: the cancel EF and the cron may both
  // fire — whoever flips pending/scheduled → running places the call. The
  // claim rotates run_id so a stale runner can never write over this one.
  // Routed through validateReservationPatch directly (not the writeReservation
  // door — this update's `.in("notice_state", …)` filter is a shape the door
  // doesn't model; see reservation-doc.ts's header and the same idiom in
  // supabase-cron-reservation-retries).
  const noticeClaimValidated = validateReservationPatch({
    notice_state: "running",
    notice_next_at: null,
    run_id: runId,
    claimed_at: new Date().toISOString(),
  });
  if (!noticeClaimValidated.ok) {
    return json({ ok: false, error: noticeClaimValidated.error }, 500);
  }
  const { data: claimed } = await admin
    .from("reservation_tickets")
    .update(noticeClaimValidated.patch)
    .eq("id", reservationId)
    .in("notice_state", ["pending", "scheduled"])
    .select("id");
  if (!claimed?.length) return json({ ok: true, skipped: "notice already claimed" });
  // A place RELEASE after a failed modification speaks about the OLD slot —
  // the one the place is still holding — not the ticket's new ask.
  const noticeLegVars: ReservationLegVars =
    kind === "place_cancel" && modificationOfIso && r.state !== "cancelled"
      ? { ...legVars, dateEs: esDate(modificationOfIso), timeEs: esTime(modificationOfIso) }
      : legVars;
  runInBackground(
    runCancelNotice({
      admin,
      reservationId,
      runId,
      key: elevenKey,
      kind,
      attemptsDone: typeof r.notice_attempts === "number" ? r.notice_attempts : 0,
      outageRetries: typeof r.outage_retries === "number" ? r.outage_retries : 0,
      toNumber,
      agentId: kind === "place_cancel" ? bookerAgentId : confirmerAgentId,
      legVars: noticeLegVars,
      placeHours: place?.hours ?? null,
      placeLng,
      reservedAtIso: r.reserved_at,
      projectId: placeId,
      placeCallCap: cfg.limits.placeCallsPerPlacePerDay,
      guestNotify,
    }),
  );
  return json({ ok: true, started: true, intent, reservation_id: reservationId });
}

// Leg 3 · claim a parked guest callback, then re-ring the guest in the
// background.
async function launchCallbackRetry(ctx: LaunchCtx): Promise<Response> {
  const {
    admin,
    reservationId,
    r,
    intent,
    elevenKey,
    placeLng,
    consumerNumber,
    confirmerAgentId,
    guestNotify,
    runId,
    legVars,
  } = ctx;
  if (guestNotify === "app") {
    await writeReservation(admin, {
      mode: "update",
      id: reservationId,
      patch: {
        callback_state: "skipped",
        callback_next_attempt_at: null,
        last_call_state: "callback retry — guest prefers app-only; no call",
      },
    });
    return json({ ok: true, skipped: "guest prefers app-only" });
  }
  if (!consumerNumber) {
    await writeReservation(admin, {
      mode: "update",
      id: reservationId,
      patch: {
        callback_state: "skipped",
        callback_next_attempt_at: null,
        last_call_state: "callback retry — no guest number",
      },
    });
    return json({ ok: true, skipped: "no guest number" });
  }
  // Claim it CAS-style — a single `.eq()` match beyond id, so this is the
  // writeReservation door itself, not a hand-built query.
  const callbackClaim = await writeReservation(admin, {
    mode: "update",
    id: reservationId,
    patch: {
      callback_state: "calling",
      callback_next_attempt_at: null,
      run_id: runId,
      claimed_at: new Date().toISOString(),
    },
    match: { callback_state: "scheduled" },
    select: "id",
  });
  if (!callbackClaim.ok || !callbackClaim.row) {
    return json({ ok: true, skipped: "callback already claimed" });
  }
  const context = r.state === "confirmed" ? "confirmation" as const : "counter_offer" as const;
  runInBackground(
    runCallbackRetry({
      admin,
      reservationId,
      runId,
      key: elevenKey,
      context,
      alternativesText: context === "counter_offer"
        ? alternativesToSpeech(normalizeAlternatives(r.alternatives))
        : "",
      consumerNumber,
      confirmerAgentId,
      legVars,
      attemptsDone: typeof r.callback_attempts === "number" ? r.callback_attempts : 0,
      outageRetries: typeof r.outage_retries === "number" ? r.outage_retries : 0,
      placeLng,
      reservedAtIso: r.reserved_at,
      guestNotify,
    }),
  );
  return json({ ok: true, started: true, intent, reservation_id: reservationId });
}

// Leg 7 · claim the scheduled reminder, then ring the guest in the background.
async function launchReminder(ctx: LaunchCtx): Promise<Response> {
  const {
    admin,
    reservationId,
    r,
    intent,
    elevenKey,
    cfg,
    placeLng,
    consumerNumber,
    confirmerAgentId,
    guestNotify,
    runId,
    legVars,
  } = ctx;
  if (guestNotify === "app") {
    await writeReservation(admin, {
      mode: "update",
      id: reservationId,
      patch: {
        reminder_state: "skipped",
        reminder_at: null,
        last_call_state: "reminder — guest prefers app-only; no call",
      },
    });
    return json({ ok: true, skipped: "guest prefers app-only" });
  }
  const reminderClaim = await writeReservation(admin, {
    mode: "update",
    id: reservationId,
    patch: {
      reminder_state: "calling",
      reminder_at: null,
      run_id: runId,
      claimed_at: new Date().toISOString(),
    },
    match: { reminder_state: "scheduled" },
    select: "id",
  });
  if (!reminderClaim.ok || !reminderClaim.row) {
    return json({ ok: true, skipped: "reminder already claimed" });
  }
  runInBackground(
    runReminder({
      admin,
      reservationId,
      runId,
      key: elevenKey,
      consumerNumber,
      confirmerAgentId,
      legVars,
      outageRetries: typeof r.outage_retries === "number" ? r.outage_retries : 0,
      reservedAtIso: r.reserved_at,
      placeLng,
      guestNotify,
      reminderEnabled: cfg.reminder.enabled,
    }),
  );
  return json({ ok: true, started: true, intent, reservation_id: reservationId });
}

// Legs 1→2 · claim the booking run, then ring the place in the background.
async function launchBook(ctx: LaunchCtx): Promise<Response> {
  const {
    admin,
    reservationId,
    r,
    cfg,
    place,
    placeId,
    placeLng,
    businessNumber,
    via,
    consumerNumber,
    bookerAgentId,
    confirmerAgentId,
    guestNotify,
    runId,
    modificationOfIso,
    legVars,
  } = ctx;
  // Claim the booking run compare-and-swap style: only ONE engine may flip a
  // non-running pending ticket to running (the old read-then-write let two
  // concurrent invokes both pass the gate and double-dial the place). The
  // claim rotates run_id — every background write is guarded by it.
  // Routed through validateReservationPatch directly (not the writeReservation
  // door — this update's `.or(...)` filter is a shape the door doesn't model;
  // see reservation-doc.ts's header and the same idiom in
  // supabase-cron-reservation-retries).
  const bookClaimValidated = validateReservationPatch({
    attempts_state: "running",
    run_id: runId,
    claimed_at: new Date().toISOString(),
    next_attempt_at: null,
    attempts_planned: ATTEMPTS,
    place_phone: businessNumber,
    consumer_phone: consumerNumber || null,
    // A stale verdict from a previous negotiation round must never be read
    // as this run's outcome — and a new errand starts a fresh guest ladder.
    reported_verdict: null,
    callback_attempts: 0,
    callback_next_attempt_at: null,
  });
  if (!bookClaimValidated.ok) {
    return json({ ok: false, error: bookClaimValidated.error }, 500);
  }
  const { data: bookClaim } = await admin
    .from("reservation_tickets")
    .update(bookClaimValidated.patch)
    .eq("id", reservationId)
    .eq("state", "pending")
    .or("attempts_state.is.null,attempts_state.neq.running")
    .select("id");
  if (!bookClaim?.length) {
    return json({ ok: true, skipped: "booking already claimed" });
  }

  runInBackground(
    runIntents({
      admin,
      reservationId,
      attemptsPlanned: ATTEMPTS,
      attemptsDone: typeof r.call_attempts === "number" ? r.call_attempts : 0,
      priorAttempts: Array.isArray(r.attempts) ? (r.attempts as ReservationAttempt[]) : [],
      placeHours: place?.hours ?? null,
      placeLng,
      businessNumber,
      consumerNumber,
      bookerAgentId,
      confirmerAgentId,
      legVars,
      callbackAttemptsDone: 0,
      reservedAtIso: r.reserved_at,
      runId,
      projectId: placeId,
      outageRetries: typeof r.outage_retries === "number" ? r.outage_retries : 0,
      placeCallCap: cfg.limits.placeCallsPerPlacePerDay,
      modificationOfIso,
      guestNotify,
      notify: (outcome) =>
        notifyReservationOutcome(admin, {
          consumerId: r.consumer_id,
          reservationId,
          referenceCode: r.reference_code ?? null,
          outcome,
          placeName: place?.name ?? null,
          placePhotos: place?.photos ?? null,
        }),
    }),
  );

  return json({
    ok: true,
    started: true,
    reservation_id: reservationId,
    dialed: businessNumber,
    via,
  });
}

// One launcher per intent; each claims its ticket compare-and-swap style and
// hands the leg runner (legs.ts) to the background task.
const LAUNCH: Record<Intent, (ctx: LaunchCtx) => Promise<Response>> = {
  cancel_notice: launchCancelNotice,
  callback_retry: launchCallbackRetry,
  reminder: launchReminder,
  book: launchBook,
};

serveJson("supabase-edgefunc-reservation-call", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

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
  const intent: Intent = bodyRes.body.intent === "callback_retry" ||
      bodyRes.body.intent === "cancel_notice" ||
      bodyRes.body.intent === "reminder"
    ? bodyRes.body.intent
    : "book";

  const elevenKey = await resolveElevenLabsKey();
  if (!elevenKey?.startsWith("sk_")) {
    return json({ ok: false, error: "ELEVENLABS_KEY not configured" }, 503);
  }

  const admin = adminClient(envRes.env);

  // Fetch place separately — reservation_tickets.place_id has no
  // PostgREST FK hint to places, so an embed 500s. places.id == projects.id.
  const { data: r, error: rErr } = await admin
    .from("reservation_tickets")
    .select(
      "id, consumer_id, reference_code, reserved_at, party_size, notes, state, place_id, is_test, place_phone, consumer_phone, attempts_state, attempts, call_attempts, callback_attempts, consumer_confirmed_at, consumer_notify, alternatives, notice_kind, notice_state, notice_attempts, reminder_state, reminder_attempts, outage_retries, modification_of, consumer:consumers(full_name, first_name, last_name, phone)",
    )
    .eq("id", reservationId)
    .maybeSingle();
  if (rErr) return json({ ok: false, error: rErr.message }, 500);
  if (!r) return json({ ok: false, error: "reservation not found" }, 404);
  const placeId = rowPlaceId(r);
  if (!placeId) return json({ ok: false, error: "reservation has no place" }, 400);
  const guestNotify: "call" | "app" = r.consumer_notify === "app" ? "app" : "call";
  // Per-intent gates — each errand has its own idea of a live ticket.
  if (intent === "book") {
    if (r.state !== "pending") {
      return json({ ok: true, skipped: `reservation is ${r.state}, not pending` });
    }
    if (r.attempts_state === "running") {
      return json({ ok: true, skipped: "intents already running" });
    }
  } else if (intent === "cancel_notice") {
    // A notice is owed by its columns, not by one state: 'cancelled' is the
    // normal case, and a failed MODIFICATION leaves the ticket unreachable/
    // unresolved while the place still holds the OLD slot. A live ticket
    // never owes one.
    if (r.state === "pending" || r.state === "confirmed") {
      return json({ ok: true, skipped: `reservation is ${r.state} — no notice while live` });
    }
    if (r.notice_kind !== "place_cancel" && r.notice_kind !== "guest_cancel") {
      return json({ ok: true, skipped: "no cancellation notice owed" });
    }
  } else if (intent === "reminder") {
    if (r.state !== "confirmed") {
      return json({ ok: true, skipped: `reservation is ${r.state}, not confirmed` });
    }
    if (r.reminder_state !== "scheduled") {
      return json({ ok: true, skipped: "reminder not scheduled" });
    }
  } else {
    // callback_retry: only a still-live verdict warrants re-ringing the guest.
    const confirmationDue = r.state === "confirmed" && !r.consumer_confirmed_at;
    const counterDue = r.state === "pending" &&
      normalizeAlternatives(r.alternatives).length > 0;
    if (!confirmationDue && !counterDue) {
      return json({ ok: true, skipped: "callback no longer applicable" });
    }
  }

  const { data: settings } = await admin
    .from("app_config")
    .select("reservations_config, agents_config")
    .eq("id", 1)
    .maybeSingle();
  const cfg = coerceReservationsCallConfig(settings?.reservations_config);

  if (intent === "reminder" && !cfg.reminder.enabled) {
    return json({ ok: true, skipped: "reminder knob off" });
  }

  // ── Kill switch: no outbound reservation call of ANY kind while on ────────
  // Park (not drop) so flipping the switch off resumes everything via the
  // cron within a minute of each parked clock coming due.
  if (cfg.limits.killSwitch) {
    const inHalfHour = new Date(Date.now() + 30 * 60_000).toISOString();
    const parkPatch: ReservationPatch = intent === "book"
      ? { attempts_state: "scheduled", next_attempt_at: inHalfHour }
      : intent === "callback_retry"
      ? { callback_state: "scheduled", callback_next_attempt_at: inHalfHour }
      : intent === "reminder"
      ? { reminder_state: "scheduled", reminder_at: inHalfHour }
      : { notice_state: "scheduled", notice_next_at: inHalfHour };
    await writeReservation(admin, {
      mode: "update",
      id: reservationId,
      patch: { ...parkPatch, last_call_state: "kill switch on — all calls held" },
    });
    return json({ ok: true, skipped: "kill switch on — parked 30 min" });
  }

  // Fleet routing: leg 1 rides eleven-a1 (booker), leg 2 eleven-a2
  // (confirmer) — ids written by sync-reservationist mode "fleet"; fallback is
  // the original single agent, whose prompt branches on {{call_direction}}.
  const fleet = ((settings?.agents_config as Record<string, unknown> | null)?.agents ?? null) as
    | Record<string, { id?: string } | undefined>
    | null;
  const bookerAgentId = fleet?.a1?.id?.trim() || reservationAgentId();
  const confirmerAgentId = fleet?.a2?.id?.trim() || reservationAgentId();

  const { data: placeRow } = await admin
    .from("place_profiles")
    .select("name, photos, phone, reservation_channel, reservation_target, hours, lng")
    .eq("id", placeId)
    .maybeSingle();
  const place = (placeRow ?? null) as PlaceRow | null;

  // ── Resolve the business number: row override → test mode → place endpoint ─
  let businessNumber = (r.place_phone ?? "").trim();
  let via = "row";
  if (!businessNumber) {
    if (cfg.testCall.enabled) {
      businessNumber = cfg.testCall.number;
      via = "test-mode number";
    } else {
      // Dial only when the door is Phone (or never picked — keep the
      // place_profiles.phone fallback so existing rows still reach the place).
      // WhatsApp / Instagram / Web / Not are not voice endpoints.
      const channel = place?.reservation_channel ?? null;
      if (
        channel === "none" || channel === "web" ||
        channel === "whatsapp" || channel === "instagram"
      ) {
        businessNumber = "";
        via = `place ${channel} endpoint — no voice dial`;
      } else {
        const endpoint = channel === "phone"
          ? (place?.reservation_target ?? "").trim()
          : "";
        businessNumber = endpoint || (place?.phone ?? "").trim();
        via = endpoint ? "place phone endpoint" : "place.phone fallback";
      }
    }
  }
  const dialsPlace = intent === "book" ||
    (intent === "cancel_notice" && r.notice_kind === "place_cancel");
  if (!businessNumber && dialsPlace) {
    // Only a place-dialing errand dies on a missing place number — and a
    // cancel notice must never corrupt attempts_state (it's 'cancelled').
    if (intent === "book") {
      await writeReservation(admin, {
        mode: "update",
        id: reservationId,
        patch: { attempts_state: "error", last_call_state: `no number to dial (${via})` },
      });
    } else {
      await writeReservation(admin, {
        mode: "update",
        id: reservationId,
        patch: {
          notice_state: "failed",
          last_call_state: `cancel notice — no place number (${via})`,
        },
      });
    }
    return json({ ok: false, error: `no number to dial (${via})` }, 422);
  }

  const consumer = (r.consumer ?? null) as ConsumerName | null;
  const consumerNumber = (r.consumer_phone ?? consumer?.phone ?? "").trim();

  const runId = crypto.randomUUID();
  const modificationOfIso = typeof r.modification_of === "string" ? r.modification_of : null;
  const legVars: ReservationLegVars = {
    placeName: place?.name?.trim() || "el lugar",
    guestName: guestName(consumer, "el cliente"),
    guestPhone: consumerNumber,
    referenceCode: (r.reference_code ?? "").trim(),
    partySize: r.party_size,
    dateEs: esDate(r.reserved_at),
    timeEs: esTime(r.reserved_at),
    specialRequests: (r.notes ?? "").trim(),
    runId,
    modificationOf: modificationOfIso
      ? { dateEs: esDate(modificationOfIso), timeEs: esTime(modificationOfIso) }
      : null,
  };
  const placeLng = typeof place?.lng === "number" ? place.lng : null;

  return LAUNCH[intent]({
    admin,
    reservationId,
    r,
    intent,
    elevenKey,
    cfg,
    place,
    placeId,
    placeLng,
    businessNumber,
    via,
    consumerNumber,
    bookerAgentId,
    confirmerAgentId,
    guestNotify,
    runId,
    modificationOfIso,
    legVars,
  });
});
