// The Reservationist FLEET — the four ElevenLabs agents, config-as-code.
//
//   eleven-a1 (es-mx) · c2b outbound booker      calls the venue for the guest
//   eleven-a2 (es-mx) · b2c outbound confirmer   calls the human guest back
//   eleven-a3 (es-mx) · consumer inbound         guest phones Mesita (support)
//   eleven-a4 (es-mx) · business inbound         venue phones Mesita (support)
//
// One EF caller family per agent (eleven-a1-* … eleven-a4-*): every capability
// is a plain webhook tool over HTTPS — anon bearer for the gateway +
// x-agent-secret for the app lock; the EDGE FUNCTIONS ARE UNIVERSAL (language
// lives only in the agent: name tag, prompt, TTS), so the same tools serve any
// future locale. Inbound identity params (caller_phone) and the outbound
// ticket key (reference_code) are BOUND to dynamic variables — the LLM never
// types them — with a prompt fallback in case a binding is ever dropped.
//
// This module only DESCRIBES the fleet; supabase-edgefunc-sync-reservationist
// mode "fleet" makes the live workspace match it (agents created once — their
// prompts are then console-tunable and never overwritten; tools + attachments
// re-synced on every run).

import { HANGUP_POLICY } from "./reservation-legs.ts";

export type FleetAgentKey = "a1" | "a2" | "a3" | "a4";

export type FleetAgentSpec = {
  key: FleetAgentKey;
  /** Console display name — carries the language tag per Pato's convention. */
  name: string;
  firstMessage: string;
  prompt: string;
  /** Workspace tool names (LLM-facing) this agent gets attached. */
  toolNames: string[];
};

// Inbound variant of the closing policy: "solved" means the caller's matter is
// handled, not a reservation verdict.
const INBOUND_HANGUP_POLICY =
  `Política de cierre (obligatoria): puedes colgar tú mismo con la herramienta end_call, pero ÚNICAMENTE cuando la gestión del llamante ya quedó RESUELTA — su duda respondida o su trámite hecho — y ya te despediste en una sola frase. Mientras siga hablando o preguntando, la llamada NO está resuelta: quédate en la línea. Está PROHIBIDO colgar antes. Únicas excepciones sin resultado: te dejan en espera más de dos minutos o la línea queda muda. Ya resuelta, no alargues la conversación ni esperes a que la otra persona cuelgue primero.`;

const A1_PROMPT = [
  `Eres el asistente de reservaciones de Mesita. Esta llamada va del consumidor hacia el negocio: llamas al restaurante {{venue_name}} DE PARTE del comensal {{guest_name}}.`,
  `Objetivo único: conseguir una mesa para {{party_size}} el {{reservation_date}} a las {{reservation_time}}, a nombre de {{guest_name}}.`,
  `Si el restaurante acepta tal cual, confirma leyendo de vuelta: nombre, personas, fecha y hora. Si piden un teléfono de contacto, da el del comensal: {{guest_phone}}. Si piden un número de referencia o confirmación, el código de Mesita es {{reference_code}}.`,
  `Si NO hay lugar exactamente así, pregunta qué opciones cercanas tienen (otra hora, otra área) y apúntalas textuales y cortas. NO aceptes ninguna alternativa por tu cuenta: Mesita se las propone al comensal y le regresa la respuesta al restaurante después.`,
  `Peticiones especiales del comensal: {{special_requests}}. Si hay alguna, menciónala una vez que haya disponibilidad; si está vacío, no menciones nada.`,
  `Antes de despedirte llama SIEMPRE la herramienta a1_report_outcome exactamente una vez con el resultado: verdict=confirmed si quedó confirmada tal como se pidió · verdict=counter_offer con la lista de alternativas si ofrecieron otras opciones · verdict=declined si no hay lugar. El código de la reservación es {{reference_code}}.`,
  `Habla natural y breve, español de México, trato de usted.`,
  HANGUP_POLICY,
].join("\n\n");

const A2_PROMPT = [
  `Eres el asistente de reservaciones de Mesita. Esta llamada va del negocio hacia el consumidor: llamas al comensal {{guest_name}} por su reservación en {{venue_name}}. El restaurante YA CONFIRMÓ.`,
  `Datos: una mesa para {{party_size}}, el {{reservation_date}} a las {{reservation_time}} en {{venue_name}}. Avísale y confírmaselos. Si pregunta por una referencia, su código es {{reference_code}}.`,
  `Según lo que responda el comensal, llama exactamente una de las herramientas antes de despedirte:`,
  `- Está de acuerdo → a2_confirm_reservation sin cambios.`,
  `- Prefiere OTRA fecha u hora → a2_confirm_reservation con new_date (formato AAAA-MM-DD) y/o new_time (HH:mm de 24 horas); convierte tú lo que diga a esos formatos usando la fecha actual {{system__time_utc}} como referencia, y explícale que Mesita lo consulta con el restaurante y le confirma.`,
  `- Quiere cancelar → a2_cancel_reservation con el motivo breve.`,
  `El código de la reservación es {{reference_code}}. No inventes disponibilidad ni prometas nada que el restaurante no haya dicho.`,
  `Habla natural, cálido y muy breve — esta llamada dura menos de un minuto. Español de México, trato de usted.`,
  HANGUP_POLICY,
].join("\n\n");

const A3_PROMPT = [
  `Eres la línea de atención telefónica de Mesita para comensales. Un cliente te está llamando.`,
  `Primer paso SIEMPRE, sin pedirle ningún dato: llama la herramienta a3_verify_caller — el número del llamante viaja solo (si la herramienta pidiera caller_phone, es {{system__caller_id}}).`,
  `Si verified=false: con amabilidad dile que no encuentras una cuenta de Mesita con el número desde el que llama, invítalo a usar la app de Mesita, y NO des información de ninguna reservación.`,
  `Si verified=true: salúdalo por su nombre y responde con la lista tickets que te regresó la herramienta — cada una trae lugar, fecha, hora, personas, estado y código de referencia. Nunca inventes reservaciones ni datos.`,
  `Qué puedes hacer por él:`,
  `- Informarle sobre sus reservaciones (léelas de tickets).`,
  `- Cancelar una reservación SUYA: confirma cuál (por su código de referencia de 8 dígitos) y llama a3_cancel_reservation con reference_code y un motivo breve.`,
  `- Cualquier otro cambio (fecha, hora, personas, lugar) por ahora se hace desde la app de Mesita: indícaselo con claridad.`,
  `Regla dura: solo hablas de las reservaciones del número verificado; nunca compartas datos de otras personas. Español de México, trato de usted, natural y breve.`,
  INBOUND_HANGUP_POLICY,
].join("\n\n");

const A4_PROMPT = [
  `Eres la línea telefónica de Mesita para negocios (restaurantes). Te llama personal de un restaurante.`,
  `Primer paso SIEMPRE, sin pedirle ningún dato: llama la herramienta a4_verify_caller — el número del llamante viaja solo (si la herramienta pidiera caller_phone, es {{system__caller_id}}).`,
  `Si verified=false: dile que ese número no está registrado como línea de ningún lugar en Mesita; pídeles llamar desde el teléfono registrado del negocio o escribir desde su consola de Mesita, y NO des información.`,
  `Si verified=true: saluda mencionando el nombre del lugar y responde con la lista tickets (las reservaciones próximas de SU lugar): cada una trae comensal, fecha, hora, personas, estado y código de referencia.`,
  `Qué puedes hacer:`,
  `- Leerles sus reservaciones próximas (de tickets).`,
  `- Cancelar una reservación de SU lugar si ya no pueden recibirla: confirma cuál (código de referencia) y llama a4_cancel_reservation con el motivo. Mesita le avisa al comensal — el restaurante NUNCA llama al cliente directamente y tú NUNCA das el teléfono del comensal.`,
  `- Otros cambios (mover hora, capacidad, etc.) por ahora no se hacen por esta línea: pídeles responder cuando Mesita los llame o usar su consola de Mesita.`,
  `Regla dura: solo hablas de reservaciones del lugar verificado. Español de México, trato de usted, breve y profesional.`,
  INBOUND_HANGUP_POLICY,
].join("\n\n");

export const FLEET_AGENTS: FleetAgentSpec[] = [
  {
    key: "a1",
    name: "eleven-a1 (es-mx) · c2b outbound booker",
    firstMessage: "¡Hola, buenas! Llamo para hacer una reservación a nombre de {{guest_name}}.",
    prompt: A1_PROMPT,
    toolNames: ["a1_report_outcome"],
  },
  {
    key: "a2",
    name: "eleven-a2 (es-mx) · b2c outbound confirmer",
    firstMessage: "¡Hola, {{guest_name}}! Le llamo de Mesita por su reservación en {{venue_name}}.",
    prompt: A2_PROMPT,
    toolNames: ["a2_confirm_reservation", "a2_cancel_reservation"],
  },
  {
    key: "a3",
    name: "eleven-a3 (es-mx) · consumer inbound",
    firstMessage: "¡Hola! Le atiende Mesita, asistente de reservaciones. ¿En qué le puedo ayudar?",
    prompt: A3_PROMPT,
    toolNames: ["a3_verify_caller", "a3_cancel_reservation"],
  },
  {
    key: "a4",
    name: "eleven-a4 (es-mx) · business inbound",
    firstMessage: "¡Hola! Le atiende Mesita, línea para restaurantes. ¿En qué le puedo ayudar?",
    prompt: A4_PROMPT,
    toolNames: ["a4_verify_caller", "a4_cancel_reservation"],
  },
];

// ── Workspace webhook tools (7) ──────────────────────────────────────────────
// Property values: `dynamic_variable` binds a param to a conversation variable
// (system__caller_id on inbound calls; reference_code rides every outbound
// leg) so the LLM cannot mistype identity/keys.

type Prop = Record<string, unknown>;

function bodySchema(
  description: string,
  required: string[],
  properties: Record<string, Prop>,
) {
  return { type: "object", description, required, properties };
}

// A bound property may set ONLY dynamic_variable (exclusive with description /
// constant_value — the EL API 422s otherwise; learned live 2026-07-27).
const CALLER_PHONE_PROP: Prop = {
  type: "string",
  dynamic_variable: "system__caller_id",
};

const REFERENCE_CODE_BOUND: Prop = {
  type: "string",
  dynamic_variable: "reference_code",
};

const REFERENCE_CODE_SPOKEN: Prop = {
  type: "string",
  description: "Código de referencia de 8 dígitos de la reservación a cancelar (ej. 48291057).",
};

export function fleetToolConfigs(
  supabaseUrl: string,
  anonKey: string,
  toolSecret: string,
): Array<{ name: string; config: Record<string, unknown> }> {
  const webhook = (
    name: string,
    description: string,
    efSlug: string,
    schema: Record<string, unknown>,
  ) => ({
    name,
    config: {
      type: "webhook",
      name,
      description,
      response_timeout_secs: 15,
      api_schema: {
        url: `${supabaseUrl}/functions/v1/${efSlug}`,
        method: "POST",
        request_headers: {
          Authorization: `Bearer ${anonKey}`,
          "x-agent-secret": toolSecret,
          "Content-Type": "application/json",
        },
        request_body_schema: schema,
      },
    },
  });

  return [
    webhook(
      "a1_report_outcome",
      "Registra en Mesita el resultado de ESTA llamada con el restaurante. Llámala exactamente una vez, justo antes de despedirte: verdict=confirmed si aceptaron tal cual · counter_offer si ofrecieron alternativas (mándalas en alternatives, textuales y cortas) · declined si no hay lugar.",
      "eleven-a1-report-outcome",
      bodySchema("Resultado de la llamada con el restaurante.", ["reference_code", "verdict"], {
        reference_code: REFERENCE_CODE_BOUND,
        verdict: {
          type: "string",
          description: "Resultado: confirmed, counter_offer o declined.",
          enum: ["confirmed", "counter_offer", "declined"],
        },
        alternatives: {
          type: "array",
          description:
            "Solo con counter_offer: las alternativas que ofreció el restaurante, una por elemento, textuales y cortas (máx. 5).",
          // items needs its own description too — every property object must
          // set exactly one of description/dynamic_variable/constant_value.
          items: { type: "string", description: "Una alternativa textual corta." },
        },
        note: { type: "string", description: "Nota breve opcional sobre la llamada." },
      }),
    ),
    webhook(
      "a2_confirm_reservation",
      "Registra la respuesta del comensal en ESTA llamada de confirmación. Sin cambios = acepta tal cual. Con new_date/new_time = pide moverla (Mesita lo consulta con el restaurante). Llámala exactamente una vez antes de despedirte, salvo que haya cancelado.",
      "eleven-a2-confirm-reservation",
      bodySchema("Confirmación (o cambio pedido) del comensal.", ["reference_code"], {
        reference_code: REFERENCE_CODE_BOUND,
        new_date: {
          type: "string",
          description: "Solo si pide otra fecha: AAAA-MM-DD (ej. 2026-08-02).",
        },
        new_time: {
          type: "string",
          description: "Solo si pide otra hora: HH:mm de 24 horas (ej. 21:30).",
        },
        note: { type: "string", description: "Nota breve opcional." },
      }),
    ),
    webhook(
      "a2_cancel_reservation",
      "Cancela la reservación porque el comensal ya no la quiere. Llámala solo si el comensal cancela en esta llamada.",
      "eleven-a2-cancel-reservation",
      bodySchema("Cancelación pedida por el comensal.", ["reference_code"], {
        reference_code: REFERENCE_CODE_BOUND,
        reason: { type: "string", description: "Motivo breve, en sus palabras." },
      }),
    ),
    webhook(
      "a3_verify_caller",
      "PRIMER paso de toda llamada: verifica al llamante por su número contra las cuentas de Mesita y devuelve su nombre y sus reservaciones recientes (lugar, fecha, hora, personas, estado, código). No pidas ningún dato antes de llamarla.",
      "eleven-a3-verify-caller",
      bodySchema("Verificación por número del llamante.", ["caller_phone"], {
        caller_phone: CALLER_PHONE_PROP,
      }),
    ),
    webhook(
      "a3_cancel_reservation",
      "Cancela una reservación DEL LLAMANTE ya verificado. Confirma antes el código de referencia de 8 dígitos con el comensal.",
      "eleven-a3-cancel-reservation",
      bodySchema("Cancelación de una reservación propia.", ["caller_phone", "reference_code"], {
        caller_phone: CALLER_PHONE_PROP,
        reference_code: REFERENCE_CODE_SPOKEN,
        reason: { type: "string", description: "Motivo breve, en sus palabras." },
      }),
    ),
    webhook(
      "a4_verify_caller",
      "PRIMER paso de toda llamada: verifica que el número del llamante sea la línea registrada de un lugar en Mesita y devuelve el lugar con sus reservaciones próximas (comensal, fecha, hora, personas, estado, código). No pidas ningún dato antes de llamarla.",
      "eleven-a4-verify-caller",
      bodySchema("Verificación por número del negocio.", ["caller_phone"], {
        caller_phone: CALLER_PHONE_PROP,
      }),
    ),
    webhook(
      "a4_cancel_reservation",
      "Cancela una reservación DEL LUGAR verificado (el restaurante ya no puede recibirla). Confirma antes el código de referencia; Mesita se encarga de avisarle al comensal.",
      "eleven-a4-cancel-reservation",
      bodySchema("Cancelación desde el negocio.", ["caller_phone", "reference_code"], {
        caller_phone: CALLER_PHONE_PROP,
        reference_code: REFERENCE_CODE_SPOKEN,
        reason: { type: "string", description: "Motivo breve del restaurante." },
      }),
    ),
  ];
}
