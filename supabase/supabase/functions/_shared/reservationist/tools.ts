// The nine webhook tools the four agents call, one Edge Function each
// (caller family eleven-a1-* … eleven-a4-*, plus the shared
// eleven-agent-get-reservation). Every tool is a plain HTTPS webhook: the anon
// key passes the gateway, x-agent-secret is the app lock.
//
// Identity and keys are BOUND to dynamic variables so the LLM never types
// them: caller_phone ← system__caller_id on inbound calls; reference_code and
// run_id ← the outbound call's variables. On inbound calls the agent takes a
// reservation's reference_code from what the tools returned — nobody on the
// line has to say a code.

export const TOOL_NAMES = [
  "a1_report_outcome",
  "a2_confirm_reservation",
  "a2_cancel_reservation",
  "a3_verify_caller",
  "a3_cancel_reservation",
  "a4_verify_caller",
  "a4_find_reservation",
  "a4_cancel_reservation",
  "get_reservation",
] as const;
export type ToolName = typeof TOOL_NAMES[number];

/** Resolves a tool name to its live workspace id (throws when missing). */
export type ToolId = (name: ToolName) => string;

type Prop = Record<string, unknown>;

function body(description: string, required: string[], properties: Record<string, Prop>) {
  return { type: "object", description, required, properties };
}

// A bound property sets ONLY dynamic_variable (exclusive with description /
// constant_value — the API 422s otherwise; learned live 2026-07-27).
const CALLER_PHONE: Prop = { type: "string", dynamic_variable: "system__caller_id" };
const REFERENCE_CODE_BOUND: Prop = { type: "string", dynamic_variable: "reference_code" };
// Generation token on every OUTBOUND call: the EFs ignore writes from a call
// whose run was replaced mid-call (a reschedule or cancel in the app).
const RUN_ID: Prop = { type: "string", dynamic_variable: "run_id" };
const REFERENCE_CODE_FROM_RESULTS: Prop = {
  type: "string",
  description:
    "El código de 8 dígitos de esa reservación, tomado de las reservaciones que regresó la verificación o la búsqueda. No se lo pidas a quien llama.",
};
const REASON: Prop = { type: "string", description: "Motivo breve, en sus palabras." };

type ToolSpec = { name: ToolName; description: string; ef: string; schema: Record<string, unknown> };

const SPECS: ToolSpec[] = [
  {
    name: "a1_report_outcome",
    ef: "eleven-a1-report-outcome",
    description:
      "Registra el resultado de esta llamada con el restaurante, una sola vez, antes de despedirte. declined: el restaurante te dijo que no hay lugar. unreachable: nunca llegaste con alguien que pueda reservar (buzón, conmutador sin salida, «llame más tarde»); Mesita reintenta. wrong_number: contestaron y no es este restaurante.",
    schema: body("Resultado de la llamada con el restaurante.", ["reference_code", "verdict"], {
      reference_code: REFERENCE_CODE_BOUND,
      run_id: RUN_ID,
      verdict: {
        type: "string",
        description:
          "confirmed (aceptaron tal cual) · counter_offer (ofrecieron otras opciones) · declined (no hay lugar) · unreachable (nadie que reserve) · wrong_number (no es este restaurante).",
        enum: ["confirmed", "counter_offer", "declined", "unreachable", "wrong_number"],
      },
      // Structured, not prose: the guest's later pick is compared against
      // these, so taking an offered option confirms without a second call.
      alternatives: {
        type: "array",
        description:
          "Solo con counter_offer: cada opción que ofreció el restaurante, por separado (máx. 5). «A las 9:30 en la terraza» es time 21:30 y note «en la terraza».",
        items: {
          type: "object",
          description: "Una opción concreta que ofreció el restaurante.",
          required: ["time"],
          properties: {
            time: { type: "string", description: "Hora en 24 horas HH:mm (las 9:30 de la noche es 21:30)." },
            date: { type: "string", description: "Solo si es para otro día: AAAA-MM-DD." },
            note: { type: "string", description: "Lo demás de esa opción, corto y textual: «en la terraza», «solo barra»." },
          },
        },
      },
      note: { type: "string", description: "Nota breve opcional sobre la llamada." },
    }),
  },
  {
    name: "a2_confirm_reservation",
    ef: "eleven-a2-confirm-reservation",
    description:
      "Registra la respuesta del comensal. Sin cambios: acepta tal cual. Con new_date y/o new_time: eligió una opción del restaurante o propuso otra fecha u hora. Si regresa confirmed_on_the_spot=true la mesa ya quedó confirmada; si regresa parked=true, Mesita le confirma por la app.",
    schema: body("Confirmación o cambio pedido por el comensal.", ["reference_code"], {
      reference_code: REFERENCE_CODE_BOUND,
      run_id: RUN_ID,
      new_date: { type: "string", description: "Solo si cambia la fecha: AAAA-MM-DD." },
      new_time: { type: "string", description: "Solo si cambia la hora: HH:mm de 24 horas." },
      note: { type: "string", description: "Nota breve opcional." },
    }),
  },
  {
    name: "a2_cancel_reservation",
    ef: "eleven-a2-cancel-reservation",
    description: "Cancela la reservación porque el comensal ya no la quiere.",
    schema: body("Cancelación pedida por el comensal.", ["reference_code"], {
      reference_code: REFERENCE_CODE_BOUND,
      run_id: RUN_ID,
      reason: REASON,
    }),
  },
  {
    name: "a3_verify_caller",
    ef: "eleven-a3-verify-caller",
    description:
      "Primer paso: verifica al comensal por el número desde el que llama y regresa su nombre de cuenta y sus reservaciones recientes (lugar, fecha, hora, personas, estado, a nombre de quién y código). No pidas ningún dato antes.",
    schema: body("Verificación por número del llamante.", ["caller_phone"], { caller_phone: CALLER_PHONE }),
  },
  {
    name: "a3_cancel_reservation",
    ef: "eleven-a3-cancel-reservation",
    description:
      "Cancela una reservación del comensal verificado. Ubícala por lugar y fecha en la conversación y toma su código de las reservaciones de la verificación; el comensal no tiene que decir ningún código.",
    schema: body("Cancelación de una reservación propia.", ["caller_phone", "reference_code"], {
      caller_phone: CALLER_PHONE,
      reference_code: REFERENCE_CODE_FROM_RESULTS,
      reason: REASON,
    }),
  },
  {
    name: "a4_verify_caller",
    ef: "eleven-a4-verify-caller",
    description:
      "Primer paso: verifica que el número desde el que llaman sea la línea de un lugar en Mesita y regresa el lugar con sus reservaciones próximas (a nombre de quién, fecha, hora, personas, estado, código). No pidas ningún dato antes.",
    schema: body("Verificación por número del lugar.", ["caller_phone"], { caller_phone: CALLER_PHONE }),
  },
  {
    name: "a4_find_reservation",
    ef: "eleven-a4-find-reservation",
    description:
      "Busca reservaciones del lugar verificado por el nombre al que están («la reservación a nombre de Ana López») o por el código de 8 dígitos si lo dictan. Solo encuentra reservaciones de este lugar. Regresa las coincidencias con su código para usarlo en otras herramientas.",
    schema: body("Búsqueda por nombre o código dentro del lugar del llamante.", ["caller_phone"], {
      caller_phone: CALLER_PHONE,
      guest_name: {
        type: "string",
        description: "El nombre al que está la reservación, tal como lo dijeron (nombre y/o apellido).",
      },
      reference_code: {
        type: "string",
        description: "Solo si dictaron un código de Mesita: sus 8 dígitos (ej. 48291057).",
      },
    }),
  },
  {
    name: "a4_cancel_reservation",
    ef: "eleven-a4-cancel-reservation",
    description:
      "Cancela una reservación del lugar verificado porque ya no pueden recibirla. Toma su código de las reservaciones que regresó la verificación o la búsqueda; el lugar no tiene que decir ningún código. Mesita le avisa al comensal.",
    schema: body("Cancelación desde el lugar.", ["caller_phone", "reference_code"], {
      caller_phone: CALLER_PHONE,
      reference_code: REFERENCE_CODE_FROM_RESULTS,
      reason: { type: "string", description: "Motivo breve del lugar." },
    }),
  },
  {
    name: "get_reservation",
    ef: "eleven-agent-get-reservation",
    description:
      "Busca una reservación en tiempo real por su código de 8 dígitos, o por el nombre y apellido a los que está. Regresa lugar, fecha, hora, personas, estado y a nombre de quién. No regresa teléfonos.",
    schema: body("Manda el código si lo dictaron; si no, el nombre y apellido.", [], {
      reference_code: { type: "string", description: "Código de 8 dígitos que dictaron (ej. 48291057)." },
      first_name: { type: "string", description: "Nombre al que está la reservación, tal como lo dijeron." },
      last_name: { type: "string", description: "Apellido al que está la reservación, tal como lo dijeron." },
    }),
  },
];

/** The workspace tool configs, ready for the ElevenLabs tools API. */
export function toolConfigs(
  supabaseUrl: string,
  anonKey: string,
  toolSecret: string,
): Array<{ name: ToolName; config: Record<string, unknown> }> {
  return SPECS.map((s) => ({
    name: s.name,
    config: {
      type: "webhook",
      name: s.name,
      description: s.description,
      response_timeout_secs: 15,
      api_schema: {
        url: `${supabaseUrl}/functions/v1/${s.ef}`,
        method: "POST",
        request_headers: {
          Authorization: `Bearer ${anonKey}`,
          "x-agent-secret": toolSecret,
          "Content-Type": "application/json",
        },
        request_body_schema: s.schema,
      },
    },
  }));
}
