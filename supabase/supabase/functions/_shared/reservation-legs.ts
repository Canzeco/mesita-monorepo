// The Reservationist's two-direction communication model, as per-leg briefs.
//
//   consumer → business  ("business_booking")     the agent calls the venue on
//                        behalf of the guest to REQUEST the reservation.
//   business → consumer  ("guest_confirmation")   after the venue confirms,
//                        the agent calls the human guest to confirm it.
//
// ONE ElevenLabs agent plays both roles. Every call carries `call_direction`
// in its dynamic variables so the console prompt can branch on
// {{call_direction}}; when the agent's security tab allows overrides, the full
// per-leg prompt + first message ride along too (placeOutboundCall falls back
// to vars-only when overrides are rejected — see _shared/elevenlabs.ts).
//
// Both briefs end with the same hang-up policy: the agent decides when the
// call is over and ends it ITSELF (the ElevenLabs `end_call` system tool —
// keep it enabled on the agent).

export type ReservationLegDirection = "business_booking" | "guest_confirmation";

export type ReservationLegVars = {
  venueName: string;
  guestName: string;
  /** The guest-side callback number the venue may be left with. */
  guestPhone: string;
  partySize: number;
  /** Venue-local es-MX date, e.g. "sábado 2 de agosto". */
  dateEs: string;
  /** Venue-local es-MX time, e.g. "8:30 p.m.". */
  timeEs: string;
  specialRequests: string;
};

// Shared closing policy — the "smart enough to hang up" rule.
const HANGUP_POLICY = `Política de cierre (obligatoria): tú decides cuándo termina la llamada y la cuelgas tú mismo con la herramienta end_call. Cuelga en cuanto el objetivo quede resuelto — confirmado, rechazado o imposible — después de despedirte en una sola frase. Si contesta un buzón de voz, deja un recado de una frase y cuelga. Si te dejan en espera más de un minuto o la línea queda muda, despídete y cuelga. Nunca alargues la conversación ni esperes a que la otra persona cuelgue primero.`;

/** Leg 1 · consumer → business: request the reservation from the venue. */
export function businessLegPrompt(v: ReservationLegVars): string {
  const requests = v.specialRequests.trim()
    ? `Peticiones especiales del comensal: ${v.specialRequests.trim()}. Menciónalas una vez confirmada la disponibilidad.`
    : "";
  return [
    `Eres el asistente de reservaciones de Mesita. Esta llamada va del consumidor hacia el negocio: llamas al restaurante ${v.venueName} DE PARTE del comensal ${v.guestName}.`,
    `Objetivo único: conseguir una reservación para ${v.partySize} ${v.partySize === 1 ? "persona" : "personas"} el ${v.dateEs} a las ${v.timeEs}, a nombre de ${v.guestName}.`,
    `Si el restaurante acepta, confirma leyendo de vuelta: nombre, ${v.partySize} ${v.partySize === 1 ? "persona" : "personas"}, ${v.dateEs}, ${v.timeEs}. Si piden un teléfono de contacto, da el del comensal: ${v.guestPhone}.`,
    `Si no hay lugar a esa hora, pregunta por la opción más cercana y acéptala SOLO si queda dentro de una hora de diferencia; si no, agradece y da la reservación por rechazada.`,
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
    `El restaurante YA CONFIRMÓ la reservación. Tu único objetivo es avisarle y confirmarle al humano los datos: ${v.partySize} ${v.partySize === 1 ? "persona" : "personas"}, el ${v.dateEs} a las ${v.timeEs} en ${v.venueName}.`,
    `No cambies nada en esta llamada: si el comensal quiere modificar o cancelar, dile que Mesita le ayuda con gusto por la app y que por ahora su reservación queda como está.`,
    `Habla natural, cálido y muy breve — esta llamada dura menos de un minuto.`,
    HANGUP_POLICY,
  ].join("\n\n");
}

export function guestLegFirstMessage(v: ReservationLegVars): string {
  return `¡Hola ${v.guestName}! Te llamo de parte de ${v.venueName}: tu reservación está confirmada.`;
}

/**
 * The dynamic variables every Reservationist call carries — same names both
 * legs, plus `call_direction` so the console prompt can branch even when
 * per-call overrides are disallowed.
 */
export function legDynamicVariables(
  direction: ReservationLegDirection,
  v: ReservationLegVars,
): Record<string, string | number | boolean> {
  return {
    call_direction: direction,
    venue_name: v.venueName,
    guest_name: v.guestName,
    guest_phone: v.guestPhone,
    party_size: v.partySize,
    reservation_date: v.dateEs,
    reservation_time: v.timeEs,
    occasion: "",
    special_requests: v.specialRequests,
  };
}
