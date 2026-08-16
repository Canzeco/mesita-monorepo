// Run discipline for the Reservationist engine — the pure decisions behind
// Product Rules §J's "platform failures never burn attempts" and the
// per-leg notice cap. No clock, no DB, no fetch — testable like the ladder.
//
// WHY the platform/target split exists: a call reads status=failed both when
// the VENUE doesn't pick up (a real protocol event — burn an attempt) and when
// ELEVENLABS ITSELF kills it (quota error 1002, 5xx — our outage, not their
// silence). The engine used to charge both against the ticket, so one credit
// dip marked live reservations "unreachable" while blaming the place. Now a
// platform failure parks on ITS OWN backoff (outage_retries) and the protocol
// ladder resumes untouched once the platform recovers.

import { nextAttemptAt } from "./reservation-retry.ts";
import { nextGuestCallAt } from "./reservation-callback.ts";

/** Attempts a1 gets to deliver a place-release notice (leg 5). */
export const VENUE_NOTICE_ATTEMPTS = 2;

/** Outage backoff: 15 min doubling to a 4 h ceiling, capped at 8 parks. */
export const OUTAGE_MAX_RETRIES = 8;
const OUTAGE_BASE_MIN = 15;
const OUTAGE_CEIL_MIN = 240;

/**
 * Classify a PLACEMENT failure (the POST itself failed — no conversation
 * exists to inspect). HTTP auth/quota/rate/server trouble is ours; 4xx
 * validation (bad number, bad agent) is a data problem the retry ladder
 * should surface normally.
 */
export function classifyPlacementFailure(httpStatus: number | null): "platform" | "target" {
  if (httpStatus === null || httpStatus === 0) return "platform"; // network
  if (httpStatus === 401 || httpStatus === 402 || httpStatus === 403 || httpStatus === 429) {
    return "platform";
  }
  if (httpStatus >= 500) return "platform";
  return "target";
}

/**
 * Classify a conversation that reached status=failed. Known platform error
 * codes mean ElevenLabs killed it; anything else (or no code) is treated as
 * the callee not answering — the conservative default, because real
 * no-answers are the common case. Extend the set as codes are observed in
 * conversation metadata (`transcript` mode shows them).
 */
const PLATFORM_ERROR_CODES = new Set([1002]); // 1002 = out of credits (observed 2026-08-02)
export function classifyFailedConversation(errorCode: number | null): "platform" | "target" {
  return errorCode !== null && PLATFORM_ERROR_CODES.has(errorCode) ? "platform" : "target";
}

/**
 * When a platform-failed call may try again — or null once the outage budget
 * is spent (→ badge-visible error state; a persistent outage must not retry
 * forever, especially on cancel notices which have no natural expiry).
 * Jitter (±20%) keeps a recovered platform from being re-slammed by a
 * synchronized cohort of parked tickets.
 */
export function outageRetryAt(
  outageRetries: number,
  now: Date = new Date(),
  jitter: () => number = Math.random,
): { at: Date; reason: string } | null {
  if (outageRetries >= OUTAGE_MAX_RETRIES) return null;
  const base = Math.min(OUTAGE_BASE_MIN * 2 ** outageRetries, OUTAGE_CEIL_MIN);
  const jittered = base * (0.8 + 0.4 * jitter());
  return {
    at: new Date(now.getTime() + jittered * 60_000),
    reason: `platform outage — retry ${outageRetries + 1}/${OUTAGE_MAX_RETRIES} in ~${
      Math.round(jittered)
    } min (attempt NOT charged)`,
  };
}

/**
 * When the next cancel-notice call may fire (Product Rules §J legs
 * 5/6) — the place side paces by the place's own opening hours with a hard
 * cap, the guest side rides the guest ladder. Extracted from the engine so
 * the one decision that dials real places is provable without a phone.
 */
export function noticeNextAt(
  kind: "venue_cancel" | "guest_cancel",
  attemptsDone: number,
  placeHours: unknown,
  placeLng: number | null,
  reservedAt: Date | null,
  now: Date = new Date(),
): { at: Date; reason: string } | null {
  if (kind === "venue_cancel") {
    if (attemptsDone >= VENUE_NOTICE_ATTEMPTS) return null;
    return nextAttemptAt(placeHours, placeLng, now);
  }
  return nextGuestCallAt(attemptsDone, placeLng, reservedAt, now);
}
