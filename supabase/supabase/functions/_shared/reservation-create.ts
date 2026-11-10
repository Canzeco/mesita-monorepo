// One tap, one reservation (MESITA-3619) — the two guards in front of
// consumer-web-create-reservation's insert, kept here so they are provable
// without a database.
//
//   replay     the same request_id from the same guest already made a ticket
//              → return THAT ticket (a retried request, a lost response).
//   duplicate  the guest already holds a live ticket (pending or confirmed,
//              its slot not yet passed) at the same place, at ANY time
//              → 409 already_reserved. One live reservation per place per
//              guest (MESITA-3640, Pato: "each place can have max one
//              reservation for the same user"); other places are free.
//   new        neither → insert.
//
// The insert itself is born scheduled (`createdTicketSchedule`): the minute
// cron (supabase-cron-retry-reservations) wakes it if the immediate push to
// the call engine is lost, so no ticket is ever left 'idle' with nothing to
// move it.

import { PASSED_GRACE_MS } from "./reservation-doc.ts";

export const ALREADY_RESERVED_CODE = "already_reserved";
export const ALREADY_RESERVED_MESSAGE =
  "You already have a reservation here. Change or cancel it first.";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The client's request id, or null when absent or not a uuid (older
 *  clients send none; a malformed one must not 500 the insert). */
export function readRequestId(v: unknown): string | null {
  return typeof v === "string" && UUID_RE.test(v.trim()) ? v.trim().toLowerCase() : null;
}

export type CreateTicket = { id: string } & Record<string, unknown>;

export type CreateGuardStore = {
  byRequest(consumerId: string, requestId: string): Promise<CreateTicket | null>;
  /** A pending or confirmed ticket of this guest here whose slot is at or
   *  after `sinceIso` (now minus the 4h passed grace, list-reservations'
   *  `upcoming`). */
  liveHere(consumerId: string, placeId: string, sinceIso: string): Promise<CreateTicket | null>;
};

export type CreateGuard =
  | { kind: "replay"; ticket: CreateTicket }
  | { kind: "duplicate"; ticket: CreateTicket }
  | { kind: "new" };

export async function guardCreate(
  store: CreateGuardStore,
  g: { consumerId: string; placeId: string; reservedAtIso: string; requestId: string | null },
  now: Date = new Date(),
): Promise<CreateGuard> {
  if (g.requestId) {
    const prior = await store.byRequest(g.consumerId, g.requestId);
    if (prior) return { kind: "replay", ticket: prior };
  }
  const since = new Date(now.getTime() - PASSED_GRACE_MS).toISOString();
  const live = await store.liveHere(g.consumerId, g.placeId, since);
  if (live) return { kind: "duplicate", ticket: live };
  return { kind: "new" };
}

/** The scheduling columns a new ticket is born with: due now, so the cron
 *  moves it if the immediate engine push never lands. */
export function createdTicketSchedule(now: Date = new Date()): {
  attempts_state: "scheduled";
  next_attempt_at: string;
} {
  return { attempts_state: "scheduled", next_attempt_at: now.toISOString() };
}
