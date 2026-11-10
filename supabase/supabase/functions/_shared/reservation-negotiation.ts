// Negotiation (MESITA-3630): what happens between "the place offered other
// times" and "both sides agree" — the rules three doors share.
//
//   a round        the guest asks for a slot the place hasn't offered
//                  (eleven-a2-confirm-reservation) or reschedules in the app
//                  (consumer-web-update-reservation): the place is called
//                  again. Each round starts FRESH call attempts — before
//                  this, round 1's two spent attempts made round 2 end the
//                  ticket 'unreachable' without dialing. Capped at
//                  MAX_NEGOTIATION_ROUNDS agent rounds per ticket.
//   an offer      the place counter-offered (ticket pending, attempts_state
//                  'answered', reported_verdict 'counter_offer'). a1 asked the
//                  place to hold its options while Mesita asks the guest.
//   taken         the guest picks one of the place's own offers: confirmed on
//                  the spot, no call to the place (a1's counter-offer close
//                  already told it a pick needs no new call).
//   unanswered    nobody picked by offerDeadline: the place is RELEASED (the
//                  a1 place notice, call_context "offer_release") and the
//                  ticket ends like any dead end — terminal, one guest
//                  notification (supabase-cron-retry-reservations sweeps it).
//
// A late result from an older round can't land on a newer one: the booking
// claim rotates run_id and clears the conversation ids
// (supabase-edgefunc-place-reservation-call launchBook), and every outcome is
// compare-and-swap on run_id + leg state + conversation id
// (reservation-call-outcome.ts).

import type { ReservationPatch } from "./reservation-doc.ts";
import { PASSED_GRACE_MS } from "./reservation-doc.ts";
import { normalizeAlternatives } from "./reservation-alternatives.ts";
import { zoneDay, zonedInstant } from "./local-time.ts";
import { CUTOFF_BEFORE_SLOT_MS } from "./reservation-callback.ts";
import { type DeadEndIo, endAtDeadEnd } from "./reservation-dead-end.ts";

/** Agent negotiation rounds per ticket; an app reschedule resets the count. */
export const MAX_NEGOTIATION_ROUNDS = 2;

/** The place leg starts over: fresh attempts, no stale verdict or offers.
 *  run_id is left alone — the booking claim rotates it — so a2's own tool
 *  calls later in the same guest call are not read as stale. */
export function freshPlaceRound(): ReservationPatch {
  return {
    call_attempts: 0,
    outage_retries: 0,
    next_attempt_at: null,
    reported_verdict: null,
    alternatives: [],
  };
}

/** a2's write when the guest proposes a slot the place hasn't offered. */
export function negotiationRoundPatch(args: {
  next: Date;
  roundsDone: number;
  now?: Date;
}): ReservationPatch {
  return {
    ...freshPlaceRound(),
    reserved_at: args.next.toISOString(),
    // New terms — the place hasn't agreed to them yet.
    state: "pending",
    consumer_confirmed_at: (args.now ?? new Date()).toISOString(),
    negotiation_rounds: args.roundsDone + 1,
    callback_attempts: 0,
    callback_next_attempt_at: null,
    reminder_state: "idle",
    reminder_at: null,
  };
}

/** The ticket columns that make an open counter-offer. */
export type OfferTicket = {
  state: string;
  attempts_state: string | null;
  reported_verdict: string | null;
  reserved_at: string;
  alternatives: unknown;
};

/** The write match that proves the offer is still open (compare-and-swap). */
export const OPEN_OFFER_MATCH = {
  state: "pending",
  attempts_state: "answered",
  reported_verdict: "counter_offer",
} as const;

export function offerOpen(t: OfferTicket): boolean {
  return t.state === OPEN_OFFER_MATCH.state &&
    t.attempts_state === OPEN_OFFER_MATCH.attempts_state &&
    t.reported_verdict === OPEN_OFFER_MATCH.reported_verdict;
}

/**
 * When an open offer stops waiting for the guest: 30 min before the LATEST
 * slot the place offered (an earlier one may pass while a later one is still
 * takeable), never later than 30 min before the expiry sweep would bury the
 * ticket (reserved_at + 4 h). Offers with no readable time fall back to the
 * requested slot.
 */
export function offerDeadline(t: Pick<OfferTicket, "reserved_at" | "alternatives">, zone: string): Date {
  const reserved = new Date(t.reserved_at).getTime();
  const ticketDay = zoneDay(new Date(t.reserved_at), zone);
  let latest: number | null = null;
  for (const a of normalizeAlternatives(t.alternatives)) {
    if (!a.time) continue;
    const at = zonedInstant(a.date ?? ticketDay, a.time, zone);
    if (at && (latest === null || at.getTime() > latest)) latest = at.getTime();
  }
  const anchor = Math.min(latest ?? reserved, reserved + PASSED_GRACE_MS);
  return new Date(anchor - CUTOFF_BEFORE_SLOT_MS);
}

/** What releasing the place adds to the dead end: the a1 place notice. */
export const RELEASE_PLACE: ReservationPatch = {
  notice_kind: "place_cancel",
  notice_state: "pending",
  notice_attempts: 0,
  notice_next_at: null,
};

/**
 * End an unanswered offer: the place is told to free what it held, the
 * ticket goes terminal and the guest gets one notification. `io.write` must
 * match OPEN_OFFER_MATCH so a pick that lands first wins. Returns whether
 * the offer was released.
 */
export async function releaseUnansweredOffer(
  io: DeadEndIo,
  t: OfferTicket,
  zone: string,
  now: Date = new Date(),
): Promise<boolean> {
  if (!offerOpen(t) || now.getTime() < offerDeadline(t, zone).getTime()) return false;
  return await endAtDeadEnd(
    io,
    "offer_unanswered",
    "the guest didn't pick one of the place's options in time — releasing the place",
    RELEASE_PLACE as Record<string, unknown>,
  );
}
