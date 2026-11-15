// The variables every reservation call carries to its agent.
//
// What each agent SAYS lives in _shared/reservationist/ (prompt, workflow,
// knowledge), synced to ElevenLabs; a call sends only these values. No
// per-call prompt or first message rides along.
//
// `venue_name`, `venue_notes`, `venue_alternatives` and the call_context values
// "cancelled_by_venue" and "offer_release" are wire keys the agents' prompts
// read; they change only together with _shared/reservationist/ and a sync.
//
// The guest's phone is deliberately absent: agents never hand it to a place
// (MESITA-3615 decision — Mesita relays).

import { zoneDay, zonedInstant } from "./local-time.ts";

export type ReservationLegVars = {
  placeName: string;
  /** The name the reservation is under: typed on Reserve, else the profile. */
  guestName: string;
  /** The reservation's 8-digit reference code. */
  referenceCode: string;
  partySize: number;
  /** Place-local es-MX date, e.g. "sábado 2 de agosto". */
  dateEs: string;
  /** Place-local es-MX time, e.g. "8:30 p.m.". */
  timeEs: string;
  /** The guest's notes. */
  specialRequests: string;
  /** This engine run's generation token — bound to the tools' run_id so a
   * report from an orphaned call is ignored. */
  runId: string;
  /** What Mesita has learned about how this place handles reservations
   *  (place notes, MESITA-3955), one line, "" when nothing yet. */
  placeNotes: string;
  /** What the guest lets a1 take without asking (MESITA-3957): the earliest
   *  and latest time, place-local es-MX; both "" when the time is exact. */
  windowFromEs?: string;
  windowToEs?: string;
  /** Where the guest wants to sit, in Spanish ("adentro", "afuera", "en la
   *  barra"); "" = no preference. */
  seatingEs?: string;
  /** Old slot when this run MOVES a confirmed booking (else null). */
  modificationOf?: { dateEs: string; timeEs: string } | null;
};

export type LegCallContext =
  | "booking"
  | "modification"
  | "cancellation"
  | "offer_release"
  /** a1 tells the place the guest kept the original table (MESITA-4073). */
  | "change_declined"
  | "confirmation"
  | "counter_offer"
  | "reminder"
  | "cancelled_by_venue";

/** The dynamic variables of one call. */
export function legDynamicVariables(
  v: ReservationLegVars,
  ctx: { callContext: LegCallContext; placeAlternatives?: string },
): Record<string, string | number | boolean> {
  return {
    venue_name: v.placeName,
    guest_name: v.guestName,
    reference_code: v.referenceCode,
    party_size: v.partySize,
    reservation_date: v.dateEs,
    reservation_time: v.timeEs,
    special_requests: v.specialRequests,
    venue_notes: v.placeNotes,
    call_context: ctx.callContext,
    venue_alternatives: ctx.placeAlternatives ?? "",
    run_id: v.runId,
    modification_of_date: v.modificationOf?.dateEs ?? "",
    modification_of_time: v.modificationOf?.timeEs ?? "",
    window_from: v.windowFromEs ?? "",
    window_to: v.windowToEs ?? "",
    seating: v.seatingEs ?? "",
  };
}

/** Spanish words for the guest's seating choice; "" = no preference. */
export function seatingEs(seating: unknown): string {
  switch (seating) {
    case "inside":
      return "adentro";
    case "outside":
      return "afuera";
    case "bar":
      return "en la barra";
    default:
      return "";
  }
}

/**
 * The instant a1 reported as the confirmed time (place-local "HH:mm" on the
 * table's own day), judged against the guest's window (MESITA-3957):
 * "same" when it is the asked time, "inside" when a1 may take it alone,
 * "outside" when only the guest can say yes. Night tables crossing midnight
 * read the nearest day.
 */
export function judgeReportedTime(
  reservedAtIso: string,
  windowMinutes: unknown,
  hhmm: string,
  zone: string,
): { kind: "same" | "inside"; iso: string } | { kind: "outside" | "invalid" } {
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  const at = new Date(reservedAtIso);
  if (!m || Number.isNaN(at.getTime())) return { kind: "invalid" };
  const time = `${m[1].padStart(2, "0")}:${m[2]}`;
  const day = zoneDay(at, zone);
  const base = zonedInstant(day, time, zone);
  if (!base) return { kind: "invalid" };
  const DAY = 86_400_000;
  const candidates = [base.getTime() - DAY, base.getTime(), base.getTime() + DAY];
  const nearest = candidates.reduce((a, b) => Math.abs(b - at.getTime()) < Math.abs(a - at.getTime()) ? b : a);
  const diffMin = Math.abs(nearest - at.getTime()) / 60_000;
  const iso = new Date(nearest).toISOString();
  if (diffMin === 0) return { kind: "same", iso };
  const w = typeof windowMinutes === "number" ? windowMinutes : 0;
  return diffMin <= w ? { kind: "inside", iso } : { kind: "outside" };
}

/** The window's edges as ISO instants, or null when the time is exact. */
export function windowEdges(
  reservedAtIso: string,
  minutes: unknown,
): { from: string; to: string } | null {
  const m = typeof minutes === "number" ? minutes : 0;
  const at = new Date(reservedAtIso).getTime();
  if (!(m > 0) || Number.isNaN(at)) return null;
  return {
    from: new Date(at - m * 60_000).toISOString(),
    to: new Date(at + m * 60_000).toISOString(),
  };
}
