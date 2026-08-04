// The Reservationist's two-direction communication model, as per-leg briefs.
//
//   consumer → business  ("business_booking")     the agent calls the venue on
//                        behalf of the guest to REQUEST the reservation.
//   business → consumer  ("guest_confirmation")   after the venue confirms,
//                        the agent calls the human guest to confirm it.
//
// Since the a1..a4 fleet exists (_shared/reservationist-fleet.ts), leg 1 is
// placed on eleven-a1 and leg 2 on eleven-a2 (agent ids in
// app_settings.agents_config.agents, fallback = the original single agent,
// which still branches on {{call_direction}}). Every call carries the same
// dynamic variables either way; when the agent's security tab allows
// overrides, the full per-leg prompt + first message ride along too
// (placeOutboundCall falls back to vars-only — see _shared/elevenlabs.ts).
//
// Both briefs end with the same hang-up policy: the agent ends the call
// ITSELF (the ElevenLabs `end_call` system tool — keep it enabled on the
// agent), but ONLY once the call is SOLVED — an explicit outcome reached
// (confirmed / declined / impossible). Hanging up before resolution is
// forbidden; voicemail, a dead line, or a 2-minute hold are the only
// no-outcome exceptions.

export type ReservationLegDirection = "business_booking" | "guest_confirmation";

export type ReservationLegVars = {
  venueName: string;
  guestName: string;
  /** The guest-side callback number the venue may be left with. */
  guestPhone: string;
  /** The ticket's 8-digit reference code — speakable if either side asks. */
  referenceCode: string;
  partySize: number;
  /** Venue-local es-MX date, e.g. "sábado 2 de agosto". */
  dateEs: string;
  /** Venue-local es-MX time, e.g. "8:30 p.m.". */
  timeEs: string;
  specialRequests: string;
  /** This engine run's generation token — rides every tool call as a bound
   * dynamic variable so a stale (orphaned) call's reports are ignored. */
  runId: string;
  /** Old slot when this run MODIFIES a confirmed booking (else null): a1
   * asks the venue to MOVE the reservation instead of booking a stranger's. */
  modificationOf?: { dateEs: string; timeEs: string } | null;
};

// Shared closing policy — hang up YOURSELF, but ONLY once the call is SOLVED.
// Exported so the fleet agents (_shared/reservationist-fleet.ts) carry the
// exact same policy text.
export const HANGUP_POLICY = `Política de cierre (obligatoria): puedes colgar tú mismo con la herramienta end_call, pero ÚNICAMENTE cuando la llamada ya quedó RESUELTA — es decir, cuando ya existe un resultado explícito: reservación confirmada, rechazada o imposible, y ya te despediste en una sola frase. Mientras la otra persona siga hablando, revisando disponibilidad, negociando, ofreciendo alternativas o haciendo preguntas, la llamada NO está resuelta: quédate en la línea y termina la gestión. Está PROHIBIDO colgar antes de tener el resultado. Únicas excepciones sin resultado: contesta un buzón de voz — deja un recado de una frase y cuelga —, te dejan en espera más de dos minutos, o la línea queda muda. Ya resuelta, no alargues la conversación ni esperes a que la otra persona cuelgue primero.`;

/** Leg 1 · consumer → business: request the reservation from the venue. */
export function businessLegPrompt(v: ReservationLegVars): string {
  const requests = v.specialRequests.trim()
    ? `Peticiones especiales del comensal: ${v.specialRequests.trim()}. Menciónalas una vez confirmada la disponibilidad.`
    : "";
  const modification = v.modificationOf
    ? `OJO — esto es un CAMBIO, no una reservación nueva: el restaurante YA tiene confirmada una mesa a nombre de ${v.guestName} para el ${v.modificationOf.dateEs} a las ${v.modificationOf.timeEs}. Pide MOVERLA a los nuevos datos. Si no pueden con el cambio, pide de una vez que CANCELEN la reservación anterior — Mesita le avisa al comensal.`
    : "";
  return [
    `Eres el asistente de reservaciones de Mesita. Esta llamada va del consumidor hacia el negocio: llamas al restaurante ${v.venueName} DE PARTE del comensal ${v.guestName}.`,
    `Objetivo único: conseguir una reservación para ${v.partySize} ${v.partySize === 1 ? "persona" : "personas"} el ${v.dateEs} a las ${v.timeEs}, a nombre de ${v.guestName}.`,
    `Si el restaurante acepta, confirma leyendo de vuelta: nombre, ${v.partySize} ${v.partySize === 1 ? "persona" : "personas"}, ${v.dateEs}, ${v.timeEs}. Si piden un teléfono de contacto, da el del comensal: ${v.guestPhone}. Si piden un número de referencia o confirmación, el código de Mesita es ${v.referenceCode}.`,
    `Si no hay lugar a esa hora, pregunta por la opción más cercana y acéptala SOLO si queda dentro de una hora de diferencia; si no, agradece y da la reservación por rechazada.`,
    modification,
    requests,
    `Habla natural y breve, español de México, trato de usted.`,
    HANGUP_POLICY,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function businessLegFirstMessage(v: ReservationLegVars): string {
  return `¡Hola, buenas! Llamo para hacer una reservación a nombre de ${v.guestName}.`;
}

/** Leg 2 · business → consumer: confirm the confirmed reservation to the human. */
export function guestLegPrompt(v: ReservationLegVars): string {
  return [
    `Eres el asistente de reservaciones de Mesita. Esta llamada va del negocio hacia el consumidor: llamas al comensal ${v.guestName} DE PARTE del restaurante ${v.venueName}.`,
    `El restaurante YA CONFIRMÓ la reservación. Tu único objetivo es avisarle y confirmarle al humano los datos: ${v.partySize} ${v.partySize === 1 ? "persona" : "personas"}, el ${v.dateEs} a las ${v.timeEs} en ${v.venueName}. Si pregunta por una referencia, su código es ${v.referenceCode}.`,
    `No cambies nada en esta llamada: si el comensal quiere modificar o cancelar, dile que Mesita le ayuda con gusto por la app y que por ahora su reservación queda como está.`,
    `Habla natural, cálido y muy breve — esta llamada dura menos de un minuto.`,
    HANGUP_POLICY,
  ].join("\n\n");
}

export function guestLegFirstMessage(v: ReservationLegVars): string {
  return `¡Hola ${v.guestName}! Te llamo de parte de ${v.venueName}: tu reservación está confirmada.`;
}

// ── Cancellation notices (RESERVATIONS-PROTOCOL.md legs 5 & 6) ───────────────
// Same two directions, different errand: nobody is booking anything — one side
// cancelled and the OTHER side must hear it. call_context rides as
// "cancellation" (a1 → venue) / "cancelled_by_venue" (a2 → guest); the fleet
// graphs branch on it, and these per-call overrides cover the fallback agent.

/** Leg 5 · consumer → business: the guest cancelled a CONFIRMED table. */
export function venueCancelNoticePrompt(v: ReservationLegVars): string {
  return [
    `Eres el asistente de reservaciones de Mesita. Esta llamada es un AVISO al restaurante ${v.venueName}: el comensal ${v.guestName} CANCELA su reservación de ${v.partySize} ${
      v.partySize === 1 ? "persona" : "personas"
    } del ${v.dateEs} a las ${v.timeEs}. Si piden el número de confirmación, el código de Mesita es ${v.referenceCode}.`,
    `Único objetivo: que el restaurante quede enterado y libere la mesa. Da el aviso claro, ofrece una disculpa breve de parte del comensal y agradece. NO pidas mesa, NO negocies, NO propongas otra fecha.`,
    `Si contesta un buzón de voz, deja el recado igual — es la línea del propio restaurante y ya tienen la reservación anotada.`,
    `Habla natural y muy breve, español de México, trato de usted.`,
    HANGUP_POLICY,
  ].join("\n\n");
}

export function venueCancelNoticeFirstMessage(v: ReservationLegVars): string {
  return `¡Hola, buenas! Le llamo de Mesita por la reservación a nombre de ${v.guestName}.`;
}

/** Leg 6 · business → consumer: the venue cancelled — the guest must know. */
export function guestCancelNoticePrompt(v: ReservationLegVars): string {
  return [
    `Eres el asistente de reservaciones de Mesita. Esta llamada es un AVISO al comensal ${v.guestName}: el restaurante ${v.venueName} tuvo que CANCELAR su reservación del ${v.dateEs} a las ${v.timeEs}.`,
    `PRIMERO confirma que hablas con ${v.guestName}; hasta entonces no des ningún detalle. Confirmado, dale la noticia con tacto, discúlpate de parte de Mesita, y dile que desde la app de Mesita puede reservar en otro lugar cuando quiera. Si pregunta por una referencia, su código es ${v.referenceCode}.`,
    `No prometas nada de parte del restaurante ni ofrezcas re-agendar en esta llamada.`,
    `Habla natural, cálido y muy breve. Español de México, trato de usted.`,
    HANGUP_POLICY,
  ].join("\n\n");
}

export function guestCancelNoticeFirstMessage(v: ReservationLegVars): string {
  return `¡Hola ${v.guestName}! Le llamo de Mesita por su reservación en ${v.venueName}.`;
}

/** Guest-leg context: what the Confirmer call is about. */
export type GuestLegContext = {
  /** "confirmation" (venue said yes) · "counter_offer" (venue offered options). */
  callContext?: string;
  /** Speakable list of the venue's alternatives — "" when none. */
  venueAlternatives?: string;
};

/**
 * The dynamic variables every Reservationist call carries — same names both
 * legs, plus `call_direction` so the console prompt can branch even when
 * per-call overrides are disallowed. `call_context` / `venue_alternatives`
 * drive the a2 (Confirmer) prompt's confirmation-vs-counter-offer branch.
 */
export function legDynamicVariables(
  direction: ReservationLegDirection,
  v: ReservationLegVars,
  extra?: GuestLegContext,
): Record<string, string | number | boolean> {
  return {
    call_direction: direction,
    venue_name: v.venueName,
    guest_name: v.guestName,
    guest_phone: v.guestPhone,
    reference_code: v.referenceCode,
    party_size: v.partySize,
    reservation_date: v.dateEs,
    reservation_time: v.timeEs,
    occasion: "",
    special_requests: v.specialRequests,
    call_context: extra?.callContext ??
      (direction === "guest_confirmation" ? "confirmation" : "booking"),
    venue_alternatives: extra?.venueAlternatives ?? "",
    // Generation token — bound to the outbound tools' run_id property so a
    // report from an orphaned call is recognized and ignored server-side.
    run_id: v.runId,
    // Modification context (empty strings when this is a plain booking).
    modification_of_date: v.modificationOf?.dateEs ?? "",
    modification_of_time: v.modificationOf?.timeEs ?? "",
  };
}
