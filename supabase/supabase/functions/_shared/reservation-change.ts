// A place asks to change a confirmed table's time or party size (MESITA-4073).
//
// Pato, 2026-11-14: a4 "can change the time or party size, not only cancel.
// The guest is told in the app and accepts the change."
//
//   1 · the place calls Mesita's line; a3 finds the table and proposes the
//       change (eleven-a4-change-reservation → judgeProposal + proposePatch).
//       The table keeps its own time and size; the guest gets a
//       Me › Notifications row (outcome change_proposed).
//   2 · the guest answers in the app (consumer-web-confirm-reservation,
//       change: accept | decline): accept moves the table on the spot (the
//       place already offered it, so no call); decline keeps the original.
//   3 · nobody answers by change_expires_at: the cron expires it like a
//       decline (supabase-cron-retry-reservations).
//
// decision: a decline or no answer keeps the ORIGINAL table and a1 tells the
// place (notice_kind change_declined → call_context "change_declined"). The
// place asked, it never cancelled: releasing the guest's table because they
// said no to the place's own request would punish the guest. A place that
// truly cannot hold the original cancels it on a3's line, and the guest hears.
// decision: the app tells the guest; no a2 call (Pato: "told in the app").
// decision: the guest has until 2 h before the earlier of the two times, at
// most 24 h; with under 15 minutes to answer the place hears "too late".
//
// Pure: no clock (now is passed), no DB.

import type { ReservationPatch } from "./reservation-doc.ts";
import { onTheSpotConfirmPatch, resolveRequestedSlot } from "./reservation-confirm.ts";
import { esDate, esTime } from "./es-speak.ts";

/** The guest answers until this long before the earlier of the two times. */
export const ANSWER_BEFORE_SLOT_MS = 2 * 3600_000;
/** …and for at most this long, so the place is never left hanging for days. */
export const ANSWER_MAX_MS = 24 * 3600_000;
/** Less time than this to answer and the place hears it is too late to ask. */
export const ANSWER_MIN_MS = 15 * 60_000;
/** A proposed time this close (or in the past) is refused. */
export const PROPOSED_MIN_LEAD_MS = 30 * 60_000;

export type ChangeTicket = {
  id: string;
  place_id: string;
  state: string;
  reserved_at: string;
  party_size: number;
};

export type ChangeAsk = {
  new_date?: unknown;
  new_time?: unknown;
  new_party_size?: unknown;
  reason?: unknown;
};

export type ProposalVerdict =
  | {
    ok: true;
    /** The proposed time, or null when the time stays. */
    next: Date | null;
    /** The proposed size, or null when the size stays. */
    partySize: number | null;
    expiresAt: Date;
  }
  | { ok: false; status: number; code: string; error: string };

const refuse = (status: number, code: string, error: string): ProposalVerdict => ({ ok: false, status, code, error });

/**
 * Whether the calling place may propose this change to this ticket.
 * `callerPlaceId` is the place whose line is calling (placeByCallerLine), or
 * null when no place owns the line. A ticket of another place reads as not
 * found, the same as a4_find_reservation (MESITA-3622, MESITA-3973).
 */
export function judgeProposal(
  ticket: ChangeTicket | null,
  callerPlaceId: string | null,
  ask: ChangeAsk,
  zone: string,
  now: Date,
): ProposalVerdict {
  if (!callerPlaceId) return refuse(403, "not_a_place", "caller number is not a Mesita place's line");
  if (!ticket || ticket.place_id !== callerPlaceId) {
    return refuse(404, "not_found", "reservation not found for that reference_code at this place");
  }
  if (ticket.state !== "confirmed") {
    return refuse(
      409,
      "not_confirmed",
      "only a confirmed table can be changed; a booking still in progress is answered when Mesita calls",
    );
  }
  const current = new Date(ticket.reserved_at);
  if (current.getTime() <= now.getTime()) return refuse(409, "passed", "this table's time already passed");

  let next: Date | null = null;
  const wantsTime = (typeof ask.new_date === "string" && ask.new_date.trim() !== "") ||
    (typeof ask.new_time === "string" && ask.new_time.trim() !== "");
  if (wantsTime) {
    const slot = resolveRequestedSlot(ticket.reserved_at, ask.new_date, ask.new_time, { trim: true }, zone);
    if (!slot.next) {
      return refuse(400, "bad_time", "new_date must be YYYY-MM-DD and new_time HH:mm (24 h, the place's clock)");
    }
    if (slot.next.getTime() !== current.getTime()) next = slot.next;
  }

  let partySize: number | null = null;
  if (ask.new_party_size !== undefined && ask.new_party_size !== null && ask.new_party_size !== "") {
    const n = typeof ask.new_party_size === "string" ? Number(ask.new_party_size) : ask.new_party_size;
    if (typeof n !== "number" || !Number.isInteger(n) || n < 1 || n > 10) {
      return refuse(400, "bad_party_size", "new_party_size must be a whole number from 1 to 10");
    }
    if (n !== ticket.party_size) partySize = n;
  }

  if (!next && partySize === null) {
    return refuse(400, "nothing_to_change", "give a new time and/or party size different from the table's own");
  }
  if (next && next.getTime() < now.getTime() + PROPOSED_MIN_LEAD_MS) {
    return refuse(422, "too_soon", "the proposed time is in the past or less than 30 minutes away");
  }
  const expiresAt = answerDeadline(current, next, now);
  if (!expiresAt) {
    return refuse(409, "too_late", "too close to the table's time to ask the guest; keep it or cancel it");
  }
  return { ok: true, next, partySize, expiresAt };
}

/** The guest's deadline, or null when there is not time enough to ask. */
export function answerDeadline(current: Date, next: Date | null, now: Date): Date | null {
  const earlier = next && next.getTime() < current.getTime() ? next : current;
  const at = Math.min(earlier.getTime() - ANSWER_BEFORE_SLOT_MS, now.getTime() + ANSWER_MAX_MS);
  return at - now.getTime() < ANSWER_MIN_MS ? null : new Date(at);
}

/** The proposal's write. The table's own time and size stay. A new
 *  proposal replaces an open one. */
export function proposePatch(
  v: { next: Date | null; partySize: number | null; expiresAt: Date },
  note: string,
  now: Date,
): ReservationPatch {
  return {
    change_state: "proposed",
    change_reserved_at: v.next ? v.next.toISOString() : null,
    change_party_size: v.partySize,
    change_note: note ? note.slice(0, 300) : null,
    change_proposed_at: now.toISOString(),
    change_expires_at: v.expiresAt.toISOString(),
    change_answered_at: null,
    last_call_state: "the place asked to change the table; waiting for the guest in the app",
  };
}

export type OpenChange = {
  state: string;
  reserved_at: string;
  change_state: string | null;
  change_reserved_at: string | null;
  change_party_size: number | null;
  change_expires_at: string | null;
};

/** A proposal the guest can still answer. */
export function changeIsOpen(t: OpenChange, now: Date): boolean {
  if (t.state !== "confirmed" || t.change_state !== "proposed") return false;
  const exp = t.change_expires_at ? new Date(t.change_expires_at).getTime() : NaN;
  return Number.isFinite(exp) && exp > now.getTime();
}

/** The guest accepts: the table moves on the spot (the place offered it). */
export function acceptChangePatch(
  t: OpenChange & { party_size: number },
  zone: string | null,
  notify: "call" | "app",
  now: Date,
): ReservationPatch {
  const next = new Date(t.change_reserved_at ?? t.reserved_at);
  return {
    ...onTheSpotConfirmPatch({
      next,
      zone,
      notify,
      now,
      lastCallState: "guest accepted the place's change in the app — confirmed on the spot",
    }),
    party_size: t.change_party_size ?? t.party_size,
    change_state: "accepted",
    change_answered_at: now.toISOString(),
  };
}

/** Notice states that mean a notice call is already owed or ringing. */
const NOTICE_BUSY = new Set(["pending", "scheduled", "running"]);

/**
 * The guest declines (or never answers): the original table stands and a1
 * owes the place one call to say so. `noticeState` is the ticket's own; a
 * notice already owed is never overwritten (the place then hears that one).
 */
export function keepOriginalPatch(
  how: "declined" | "expired",
  noticeState: string | null,
  now: Date,
): ReservationPatch {
  const tellPlace = !NOTICE_BUSY.has(noticeState ?? "none");
  return {
    change_state: how,
    change_answered_at: now.toISOString(),
    last_call_state: how === "declined"
      ? "guest declined the place's change in the app — the original table stands"
      : "the place's change expired unanswered — the original table stands",
    ...(tellPlace
      ? { notice_kind: "change_declined", notice_state: "pending", notice_attempts: 0, notice_next_at: null }
      : {}),
  };
}

/** The change, spoken, for a1's change_declined call ("las 9:00 p.m., para 4"). */
export function changeToSpeech(
  t: { change_reserved_at: string | null; change_party_size: number | null; reserved_at: string },
  zone: string,
): string {
  const parts: string[] = [];
  if (t.change_reserved_at) {
    const sameDay = esDate(t.change_reserved_at, zone) === esDate(t.reserved_at, zone);
    parts.push(
      sameDay
        ? `las ${esTime(t.change_reserved_at, zone)}`
        : `el ${esDate(t.change_reserved_at, zone)} a las ${esTime(t.change_reserved_at, zone)}`,
    );
  }
  if (t.change_party_size) parts.push(`para ${t.change_party_size} personas`);
  return parts.join(", ");
}
