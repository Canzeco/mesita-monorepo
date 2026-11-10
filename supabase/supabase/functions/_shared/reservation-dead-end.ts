// A reservation always moves (MESITA-3619): every booking dead end ENDS the
// ticket and TELLS the guest. Before this, a run that could not go on parked
// attempts_state='error' and left the ticket 'pending' — the guest watched
// "Booking" until the 4 h expiry buried it, and nobody told them.
//
//   dead end      outcome      when
//   ────────────  ───────────  ─────────────────────────────────────────────
//   no_number     unresolved   the place has no number we can dial
//   no_line       unresolved   our calling line stayed unusable (outage clock spent)
//   outage        unresolved   ElevenLabs stayed down (outage clock spent)
//   no_key        unresolved   the calling key is missing
//   crash         unresolved   the run crashed
//   expired       unresolved   the reserved time passed while still Booking
//   no_answer     unreachable  every attempt rang out (the ladder ran dry)
//
// One patch for all of them, so "ended" means the same thing everywhere: a
// terminal state, nothing left scheduled, no guest call owed. The Me ›
// Notifications row is written only when the end actually landed — a run
// whose ticket moved on (reschedule, cancel) must not notify about it.

import type { ReservationOutcome } from "./reservation-notification.ts";

export type DeadEnd =
  | "no_number"
  | "no_line"
  | "outage"
  | "no_key"
  | "crash"
  | "expired"
  | "no_answer";

export function deadEndOutcome(d: DeadEnd): Extract<ReservationOutcome, "unreachable" | "unresolved"> {
  return d === "no_answer" ? "unreachable" : "unresolved";
}

/** The ticket patch that ends a booking at a dead end. `extra` carries a
 *  leg's own additions (e.g. releasing the old hold after a failed
 *  modification). */
export function deadEndPatch(
  d: DeadEnd,
  reason: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    state: deadEndOutcome(d),
    attempts_state: "exhausted",
    next_attempt_at: null,
    callback_state: "skipped",
    callback_next_attempt_at: null,
    ...extra,
    last_call_state: reason.slice(0, 200),
  };
}

export type DeadEndIo = {
  /** Writes the patch; true when it landed on the ticket. */
  write(patch: Record<string, unknown>): Promise<boolean>;
  /** Writes the guest's Me › Notifications row; never throws. */
  notify(outcome: ReservationOutcome): Promise<void>;
};

/** End the ticket, then tell the guest. Returns whether it ended. */
export async function endAtDeadEnd(
  io: DeadEndIo,
  d: DeadEnd,
  reason: string,
  extra: Record<string, unknown> = {},
): Promise<boolean> {
  const landed = await io.write(deadEndPatch(d, reason, extra));
  if (landed) await io.notify(deadEndOutcome(d));
  return landed;
}
