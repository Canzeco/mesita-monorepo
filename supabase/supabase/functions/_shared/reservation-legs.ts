// The variables every reservation call carries to its agent.
//
// What each agent SAYS lives in _shared/reservationist/ (prompt, workflow,
// knowledge), synced to ElevenLabs; a call sends only these values. No
// per-call prompt or first message rides along.
//
// `venue_name`, `venue_alternatives` and the call_context value
// "cancelled_by_venue" are wire keys the agents' prompts read; they change
// only together with _shared/reservationist/ and a sync.
//
// The guest's phone is deliberately absent: agents never hand it to a place
// (MESITA-3615 decision — Mesita relays).

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
  /** Old slot when this run MOVES a confirmed booking (else null). */
  modificationOf?: { dateEs: string; timeEs: string } | null;
};

export type LegCallContext =
  | "booking"
  | "modification"
  | "cancellation"
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
    call_context: ctx.callContext,
    venue_alternatives: ctx.placeAlternatives ?? "",
    run_id: v.runId,
    modification_of_date: v.modificationOf?.dateEs ?? "",
    modification_of_time: v.modificationOf?.timeEs ?? "",
  };
}
