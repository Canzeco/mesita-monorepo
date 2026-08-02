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
  `Eres el asistente de reservaciones de Mesita. Esta llamada va del negocio hacia el consumidor: llamas al comensal {{guest_name}} por su reservación en {{venue_name}} (una mesa para {{party_size}}). El código interno es {{reference_code}} — el comensal NO necesita saberlo; menciónalo solo si él lo pide.`,
  `Contexto de esta llamada: {{call_context}}.`,
  `- Si es "confirmation": el restaurante YA CONFIRMÓ el {{reservation_date}} a las {{reservation_time}}. Avísale y confírmale los datos.`,
  `- Si es "counter_offer": el restaurante NO pudo con el {{reservation_date}} a las {{reservation_time}} y ofreció estas opciones: {{venue_alternatives}}. Preséntaselas tal cual. El comensal puede elegir una, o proponer algo TOTALMENTE distinto (por ejemplo "mejor mañana a las nueve") — ambas valen.`,
  `Según lo que responda, llama exactamente una herramienta antes de despedirte:`,
  `- Acepta tal cual (solo en confirmation) → a2_confirm_reservation sin cambios.`,
  `- Elige una alternativa o propone otra fecha u hora → a2_confirm_reservation con new_date (AAAA-MM-DD) y/o new_time (HH:mm de 24 horas); convierte tú lo que diga usando la fecha actual {{system__time_utc}} como referencia. Explícale que Mesita llama al restaurante para amarrar la nueva hora y le confirma en cuanto quede.`,
  `- Quiere cancelar → a2_cancel_reservation con el motivo breve.`,
  `Si la herramienta regresa parked=true: dile que su petición quedó anotada y que Mesita le confirma por la app — no prometas otra llamada.`,
  `No inventes disponibilidad ni prometas nada que el restaurante no haya dicho.`,
  `Habla natural, cálido y muy breve. Español de México, trato de usted.`,
  HANGUP_POLICY,
].join("\n\n");

const A3_PROMPT = [
  `Eres la línea de atención telefónica de Mesita para comensales. Un cliente te está llamando.`,
  `Primer paso SIEMPRE, sin pedirle ningún dato: llama la herramienta a3_verify_caller — el número del llamante viaja solo (si la herramienta pidiera caller_phone, es {{system__caller_id}}).`,
  `Si verified=false: con amabilidad dile que no encuentras una cuenta de Mesita con el número desde el que llama, invítalo a usar la app de Mesita, y NO des información de ninguna reservación.`,
  `Si verified=true: salúdalo por su nombre y responde con la lista tickets que te regresó la herramienta — cada una trae lugar, fecha, hora, personas, estado y código de referencia. Nunca inventes reservaciones ni datos.`,
  `Qué puedes hacer por él:`,
  `- Informarle sobre sus reservaciones (léelas de tickets).`,
  `- Cancelar una reservación SUYA: identifícala por LUGAR y FECHA en la conversación (el comensal NO necesita saber ningún código — el reference_code lo tomas tú del ticket correspondiente en tickets) y llama a3_cancel_reservation con ese reference_code y un motivo breve. Si el comensal te dicta un código de 8 dígitos, también sirve, pero es secundario.`,
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
  `- Buscar una reservación por el NOMBRE del comensal — el camino normal ("la reservación de Ana López"): llama a4_find_reservation con guest_name tal como lo digan. El código de referencia es secundario; el restaurante NO necesita saberlo.`,
  `- Cancelar una reservación de SU lugar si ya no pueden recibirla: ubícala por nombre (a4_find_reservation) o en tickets, toma tú el reference_code del resultado y llama a4_cancel_reservation con el motivo. Mesita le avisa al comensal — el restaurante NUNCA llama al cliente directamente y tú NUNCA das el teléfono del comensal.`,
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
    toolNames: ["a3_verify_caller", "a3_cancel_reservation", "get_reservation"],
  },
  {
    key: "a4",
    name: "eleven-a4 (es-mx) · business inbound",
    firstMessage: "¡Hola! Le atiende Mesita, línea para restaurantes. ¿En qué le puedo ayudar?",
    prompt: A4_PROMPT,
    toolNames: ["a4_verify_caller", "a4_find_reservation", "a4_cancel_reservation", "get_reservation"],
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
      "Registra la respuesta del comensal en ESTA llamada. Sin cambios = acepta tal cual. Con new_date/new_time = eligió una alternativa del restaurante O propuso otra fecha/hora — Mesita llama de nuevo al restaurante para amarrarla (si regresa parked=true ya no habrá más llamadas: queda en la app). Llámala exactamente una vez antes de despedirte, salvo que haya cancelado.",
      "eleven-a2-confirm-reservation",
      bodySchema("Confirmación (o cambio pedido) del comensal.", ["reference_code"], {
        reference_code: REFERENCE_CODE_BOUND,
        new_date: {
          type: "string",
          description: "Solo si cambia la fecha: AAAA-MM-DD (ej. 2026-08-02). Puede ir sola.",
        },
        new_time: {
          type: "string",
          description: "Solo si cambia la hora: HH:mm de 24 horas (ej. 21:30). Puede ir sola.",
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
      "a4_find_reservation",
      "Busca reservaciones EN EL LUGAR verificado por el NOMBRE del comensal — la forma normal de ubicar una reservación ('la de Ana López'); el código de 8 dígitos es secundario. Devuelve las coincidencias con su reference_code para usarlo en otras herramientas.",
      "eleven-a4-find-reservation",
      bodySchema("Búsqueda por nombre dentro del lugar del llamante.", [
        "caller_phone",
        "guest_name",
      ], {
        caller_phone: CALLER_PHONE_PROP,
        guest_name: {
          type: "string",
          description: "Nombre del comensal tal como lo dijo el restaurante (nombre y/o apellido).",
        },
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
    // Transitional shared lookup (EF caller eleven-agent-*): real-time ticket
    // lookup by reference code. Attached to the inbound agents (a3/a4) for the
    // "tengo un código" paths; response carries NO phone numbers.
    webhook(
      "get_reservation",
      "Busca una reservación de Mesita en la base de datos en TIEMPO REAL por su código de referencia de 8 dígitos (o, como último recurso, por nombre y apellido del comensal). Devuelve lugar, fecha, hora, personas y estado, listos para decirse en voz alta.",
      "eleven-agent-get-reservation",
      bodySchema("Claves de búsqueda — manda el código si lo tienes; el nombre es secundario.", [], {
        reference_code: {
          type: "string",
          description: "Código de referencia de 8 dígitos de la reservación (ej. 48291057).",
        },
        first_name: { type: "string", description: "Nombre del comensal, tal como lo dijo." },
        last_name: { type: "string", description: "Apellido del comensal, tal como lo dijo." },
      }),
    ),
  ];
}

// ── Workflow graphs (config-as-code) ─────────────────────────────────────────
// Procedures are Alpha — unused. Workflows only. Pushed by
// supabase-edgefunc-sync-reservationist mode "workflows".
// OpenAPI: top-level AgentWorkflowRequestModel { nodes, edges, prevent_subagent_loops }.
// Versioned agents: PATCH must target main via ?branch_id=… + version_description.

export type FleetWorkflow = {
  nodes: Record<string, Record<string, unknown>>;
  edges: Record<string, Record<string, unknown>>;
  prevent_subagent_loops: boolean;
};

function pos(x: number, y: number) {
  return { x, y };
}

function edge(
  source: string,
  target: string,
  forward: Record<string, unknown>,
  backward?: Record<string, unknown>,
) {
  const e: Record<string, unknown> = {
    source,
    target,
    forward_condition: forward,
  };
  if (backward) e.backward_condition = backward;
  return e;
}

const UNCOND = { type: "unconditional" as const };
const RESULT_OK = { type: "result" as const, successful: true, label: "success" };
const RESULT_FAIL = { type: "result" as const, successful: false, label: "failure" };

/** Unconditional backward condition — lets the flow return along the edge. */
function back(label: string) {
  return { type: "unconditional" as const, label };
}

function llm(condition: string, label: string) {
  return { type: "llm" as const, condition, label };
}

/** Subagent with no webhook tools — tools run only via dedicated tool nodes. */
function talkNode(opts: {
  label: string;
  position: { x: number; y: number };
  additionalPrompt: string;
  edgeOrder: string[];
  /** Outbound should speak immediately; inbound after a tool usually too. */
  entryBehavior: "generate_immediately" | "wait_for_user" | "auto";
}): Record<string, unknown> {
  return {
    type: "override_agent",
    label: opts.label,
    position: opts.position,
    additional_prompt: opts.additionalPrompt,
    entry_behavior: opts.entryBehavior,
    // Overwrite attached tools for this phase — family tools fire as tool nodes.
    conversation_config: {
      agent: { prompt: { tool_ids: [] } },
    },
    edge_order: opts.edgeOrder,
  };
}

function toolNode(
  toolId: string,
  position: { x: number; y: number },
  edgeOrder: string[],
): Record<string, unknown> {
  return {
    type: "tool",
    position,
    tools: [{ tool_id: toolId }],
    edge_order: edgeOrder,
  };
}

function requireTool(ids: Map<string, string>, name: string): string {
  const id = ids.get(name);
  if (!id) throw new Error(`workspace missing tool ${name}`);
  return id;
}

/**
 * Build the four fleet workflows (v2 — complex graphs). Tool nodes need live
 * workspace tool ids.
 *
 * Engine truths these graphs encode (supabase-edgefunc-reservation-call):
 * - a1: an ANSWERED call that ends without a1_report_outcome goes terminal
 *   (analysis fallback → declined/unresolved), so EVERY spoken path funnels
 *   through exactly one report tool node before the farewell. No silent
 *   voicemail exit — that needs an engine-side verdict first (deploy-gated).
 * - a2: tools fire only on explicit guest action; a voicemail message with no
 *   tool call is safe (ticket state simply doesn't move — same as no answer).
 * - a3/a4: inbound; identity rides system__caller_id bindings. get_reservation
 *   is the code-only lookup lane (response carries no phone numbers).
 */
export function fleetWorkflows(toolIdByName: Map<string, string>): Record<FleetAgentKey, FleetWorkflow> {
  const a1Report = requireTool(toolIdByName, "a1_report_outcome");
  const a2Confirm = requireTool(toolIdByName, "a2_confirm_reservation");
  const a2Cancel = requireTool(toolIdByName, "a2_cancel_reservation");
  const a3Verify = requireTool(toolIdByName, "a3_verify_caller");
  const a3Cancel = requireTool(toolIdByName, "a3_cancel_reservation");
  const a4Verify = requireTool(toolIdByName, "a4_verify_caller");
  const a4Find = requireTool(toolIdByName, "a4_find_reservation");
  const a4Cancel = requireTool(toolIdByName, "a4_cancel_reservation");
  const getRes = requireTool(toolIdByName, "get_reservation");

  return {
    // a1 · gatekeeper → negotiate → per-outcome report (confirmed / counter /
    // declined) → tailored farewell → end. The three report nodes fire the
    // SAME tool; the branch fixes the verdict context and the closing line.
    a1: {
      prevent_subagent_loops: true,
      nodes: {
        start_node: { type: "start", position: pos(0, 0), edge_order: ["e_start_gk"] },
        gatekeeper: talkNode({
          label: "Reach the right person",
          position: pos(300, 0),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Primer contacto: saluda y di que llamas para hacer una reservación a nombre de {{guest_name}}. Si contesta un conmutador/IVR o alguien que no toma reservaciones, pide con cortesía que te comuniquen con quien sí las tome; acepta esperas cortas en línea. En cuanto te atienda una persona que pueda tomar la reservación, AVANZA. Aquí no negocies, no te despidas y no intentes llamar herramientas.",
          edgeOrder: ["e_gk_book"],
        }),
        book: talkNode({
          label: "Negotiate the table",
          position: pos(620, 0),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Negocia la mesa: {{party_size}} personas, {{reservation_date}} a las {{reservation_time}}, a nombre de {{guest_name}}. Si piden un teléfono de contacto da {{guest_phone}}; si piden número de confirmación, el código Mesita es {{reference_code}}. Menciona {{special_requests}} una sola vez si no está vacío y hay disponibilidad. Si no pueden tal cual, pregunta qué opciones cercanas tienen y apúntalas textuales y cortas — NO aceptes ninguna por tu cuenta. Con un resultado claro (confirmaron tal cual · ofrecieron alternativas · rechazaron/no hay lugar) AVANZA por la rama correcta SIN despedirte; el flujo dispara el registro. No inventes disponibilidad.",
          edgeOrder: ["e_book_confirmed", "e_book_counter", "e_book_declined"],
        }),
        report_confirmed: toolNode(a1Report, pos(940, -170), ["e_rc_farewell"]),
        report_counter: toolNode(a1Report, pos(940, 0), ["e_rco_farewell"]),
        report_declined: toolNode(a1Report, pos(940, 170), ["e_rd_farewell"]),
        farewell_ok: talkNode({
          label: "Confirm & close",
          position: pos(1260, -170),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "La mesa quedó CONFIRMADA y ya se registró (verdict=confirmed). Lee de vuelta en una sola frase: nombre, personas, fecha y hora. Agradece, despídete corto y cuelga con end_call.",
          edgeOrder: ["e_fok_end"],
        }),
        farewell_counter: talkNode({
          label: "Counter-offer close",
          position: pos(1260, 0),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Las alternativas ya se registraron (verdict=counter_offer). Di que Mesita se las propone al comensal y les regresa la respuesta. Agradece, despídete corto y cuelga con end_call.",
          edgeOrder: ["e_fco_end"],
        }),
        farewell_declined: talkNode({
          label: "Declined close",
          position: pos(1260, 170),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "El resultado ya se registró (verdict=declined). Agradece el tiempo, despídete corto y cuelga con end_call.",
          edgeOrder: ["e_fd_end"],
        }),
        end_node: { type: "end", position: pos(1580, 0), edge_order: [] },
      },
      edges: {
        e_start_gk: edge("start_node", "gatekeeper", UNCOND),
        e_gk_book: edge(
          "gatekeeper",
          "book",
          llm("Ya te atiende una persona que puede tomar o negociar la reservación.", "host reached"),
        ),
        // Backward RESULT_FAIL: if the report webhook fails, fall back to book
        // and try the outcome again rather than closing unreported.
        e_book_confirmed: edge(
          "book",
          "report_confirmed",
          llm("El restaurante CONFIRMÓ la mesa tal como se pidió.", "confirmed"),
          RESULT_FAIL,
        ),
        e_book_counter: edge(
          "book",
          "report_counter",
          llm(
            "El restaurante NO puede tal cual y ofreció alternativas concretas (otra hora u otra área).",
            "counter-offer",
          ),
          RESULT_FAIL,
        ),
        e_book_declined: edge(
          "book",
          "report_declined",
          llm("El restaurante rechazó definitivamente: no hay lugar ni alternativas.", "declined"),
          RESULT_FAIL,
        ),
        e_rc_farewell: edge("report_confirmed", "farewell_ok", RESULT_OK),
        e_rco_farewell: edge("report_counter", "farewell_counter", RESULT_OK),
        e_rd_farewell: edge("report_declined", "farewell_declined", RESULT_OK),
        e_fok_end: edge(
          "farewell_ok",
          "end_node",
          llm("Ya leíste los datos de vuelta y te despediste.", "done"),
        ),
        e_fco_end: edge(
          "farewell_counter",
          "end_node",
          llm("Ya avisaste que Mesita regresa la respuesta y te despediste.", "done"),
        ),
        e_fd_end: edge("farewell_declined", "end_node", llm("Ya agradeciste y te despediste.", "done")),
      },
    },

    // a2 · route by call_context (confirmation / counter_offer / voicemail) →
    // dedicated presentation → confirm-or-cancel tools → tailored farewell.
    a2: {
      prevent_subagent_loops: true,
      nodes: {
        start_node: { type: "start", position: pos(0, 0), edge_order: ["e_start_route"] },
        route: talkNode({
          label: "Open & route by context",
          position: pos(300, 0),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Saluda a {{guest_name}} y di que llamas de Mesita por su reservación en {{venue_name}}. Enruta según {{call_context}} (confirmation o counter_offer). Si contesta un buzón de voz o grabadora en lugar de una persona, toma la rama de buzón. Aquí no llames herramientas.",
          edgeOrder: ["e_route_confirmation", "e_route_counter", "e_route_voicemail"],
        }),
        present_confirmation: talkNode({
          label: "Deliver confirmation",
          position: pos(640, -180),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Contexto confirmation: el restaurante YA CONFIRMÓ el {{reservation_date}} a las {{reservation_time}} para {{party_size}}. Avísale y confírmale los datos. El comensal puede aceptar tal cual, proponer otra fecha u hora, o cancelar — AVANZA por la rama que corresponda; no cuelgues todavía.",
          edgeOrder: ["e_pc_confirm", "e_pc_cancel"],
        }),
        present_alternatives: talkNode({
          label: "Present alternatives",
          position: pos(640, 120),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Contexto counter_offer: el restaurante NO pudo con el horario pedido y ofreció: {{venue_alternatives}}. Preséntaselas tal cual. Puede elegir una, proponer algo TOTALMENTE distinto, o cancelar — AVANZA por la rama que corresponda. Convierte lo que diga a fecha/hora usando {{system__time_utc}} como referencia. No inventes disponibilidad ni prometas nada que el restaurante no dijo.",
          edgeOrder: ["e_pa_confirm", "e_pa_cancel"],
        }),
        voicemail: talkNode({
          label: "Voicemail message",
          position: pos(640, 400),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Es un buzón de voz: deja UN recado de una sola frase — que Mesita llamó por su reservación en {{venue_name}} y que puede revisar y confirmar en la app de Mesita — y cuelga con end_call. NO llames ninguna herramienta ni des más datos.",
          edgeOrder: ["e_vm_end"],
        }),
        do_confirm: toolNode(a2Confirm, pos(980, -180), ["e_dc_farewell"]),
        do_cancel: toolNode(a2Cancel, pos(980, 120), ["e_dx_farewell"]),
        farewell_done: talkNode({
          label: "Close (registered)",
          position: pos(1300, -180),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Quedó registrado. Si la herramienta regresó parked=true, di que su petición quedó anotada y que Mesita le confirma por la app — no prometas otra llamada. Si hubo cambio de fecha/hora, explica que Mesita llama al restaurante para amarrarla y le confirma en cuanto quede. Despídete corto y cuelga con end_call.",
          edgeOrder: ["e_fdone_end"],
        }),
        farewell_cancel: talkNode({
          label: "Close (cancelled)",
          position: pos(1300, 120),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "La cancelación quedó registrada. Lamenta brevemente, agradece y cuelga con end_call.",
          edgeOrder: ["e_fcancel_end"],
        }),
        end_node: { type: "end", position: pos(1620, 0), edge_order: [] },
      },
      edges: {
        e_start_route: edge("start_node", "route", UNCOND),
        e_route_confirmation: edge(
          "route",
          "present_confirmation",
          llm("El contexto de la llamada es confirmation: el restaurante ya confirmó.", "confirmation"),
        ),
        e_route_counter: edge(
          "route",
          "present_alternatives",
          llm("El contexto es counter_offer: hay alternativas del restaurante que presentar.", "counter-offer"),
        ),
        e_route_voicemail: edge(
          "route",
          "voicemail",
          llm("Contestó un buzón de voz o una grabadora, no una persona.", "voicemail"),
        ),
        e_pc_confirm: edge(
          "present_confirmation",
          "do_confirm",
          llm(
            "Acepta tal cual, o eligió/propuso una nueva fecha u hora (mándala en new_date AAAA-MM-DD / new_time HH:mm).",
            "confirm",
          ),
          RESULT_FAIL,
        ),
        e_pc_cancel: edge(
          "present_confirmation",
          "do_cancel",
          llm("El comensal quiere cancelar la reservación.", "cancel"),
          RESULT_FAIL,
        ),
        e_pa_confirm: edge(
          "present_alternatives",
          "do_confirm",
          llm(
            "Eligió una alternativa o propuso otra fecha u hora (mándala en new_date AAAA-MM-DD / new_time HH:mm).",
            "confirm",
          ),
          RESULT_FAIL,
        ),
        e_pa_cancel: edge(
          "present_alternatives",
          "do_cancel",
          llm("El comensal quiere cancelar.", "cancel"),
          RESULT_FAIL,
        ),
        e_dc_farewell: edge("do_confirm", "farewell_done", RESULT_OK),
        e_dx_farewell: edge("do_cancel", "farewell_cancel", RESULT_OK),
        e_fdone_end: edge("farewell_done", "end_node", llm("Ya cerraste y te despediste.", "done")),
        e_fcancel_end: edge("farewell_cancel", "end_node", llm("Ya cerraste y te despediste.", "done")),
        e_vm_end: edge("voicemail", "end_node", llm("Ya dejaste el recado y colgaste.", "done")),
      },
    },

    // a3 · verify → triage (inform / cancel-with-confirmation / redirect) on
    // the verified lane; deny + reference-code lookup on the unverified lane.
    a3: {
      prevent_subagent_loops: true,
      nodes: {
        start_node: { type: "start", position: pos(0, 0), edge_order: ["e_start_verify"] },
        verify: toolNode(a3Verify, pos(280, 0), ["e_verify_ok", "e_verify_fail"]),
        triage: talkNode({
          label: "Triage guest",
          position: pos(580, -160),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Caller verified=true. Saluda por su nombre y pregunta en qué le ayudas. Usa SOLO los tickets de la verificación; nunca inventes reservaciones ni hables de datos de otras personas. Según lo que pida, AVANZA: informar sus reservaciones · cancelar una suya · otros cambios (fecha/hora/personas → app Mesita).",
          edgeOrder: ["e_triage_inform", "e_triage_cancel", "e_triage_redirect"],
        }),
        inform: talkNode({
          label: "Read their tickets",
          position: pos(900, -320),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Léele sus reservaciones de los tickets verificados: lugar, fecha, hora, personas y estado — breve y claro. Si decide cancelar una, AVANZA a la confirmación de cancelación. Si ya quedó resuelto, despídete y cierra.",
          edgeOrder: ["e_inform_cancel", "e_inform_end"],
        }),
        confirm_cancel: talkNode({
          label: "Confirm cancellation",
          position: pos(900, -120),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Identifica la reservación por LUGAR y FECHA en la conversación (el comensal NO necesita ningún código — el reference_code lo tomas tú del ticket correspondiente). Confirma UNA vez: '¿Cancelo su reservación en X del día Y?'. Solo con un sí claro AVANZA a cancelar.",
          edgeOrder: ["e_cc_cancel"],
        }),
        do_cancel: toolNode(a3Cancel, pos(1220, -120), ["e_dc_done"]),
        cancel_done: talkNode({
          label: "Cancelled — close",
          position: pos(1540, -120),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "La cancelación quedó hecha. Confírmalo en una frase, ofrece ayudar en algo más y, resuelto, despídete y cuelga con end_call.",
          edgeOrder: ["e_done_end"],
        }),
        redirect_app: talkNode({
          label: "Redirect to app",
          position: pos(900, 60),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Cambios de fecha, hora o personas por ahora se hacen desde la app de Mesita: indícaselo con claridad y amabilidad, despídete y cuelga con end_call.",
          edgeOrder: ["e_redirect_end"],
        }),
        deny: talkNode({
          label: "Unknown caller",
          position: pos(580, 260),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Caller verified=false. Di que no encuentras una cuenta de Mesita con el número desde el que llama. Ofrece UNA alternativa: si tiene su código de referencia de 8 dígitos, puedes revisar esa reservación puntual; si no, invítalo a la app de Mesita. PROHIBIDO dar datos sin código.",
          edgeOrder: ["e_deny_code", "e_deny_end"],
        }),
        code_lookup: toolNode(getRes, pos(900, 260), ["e_code_info"]),
        code_info: talkNode({
          label: "Code result",
          position: pos(1220, 260),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Informa SOLO lo que regresó la búsqueda por código: lugar, fecha, hora, personas y estado de ESA reservación. Para cualquier cambio o cancelación: la app de Mesita, o llamar desde el número registrado de su cuenta. No busques por nombre; no des datos de nada más. Resuelto, despídete y cuelga con end_call.",
          edgeOrder: ["e_ci_end"],
        }),
        end_node: { type: "end", position: pos(1860, 0), edge_order: [] },
      },
      edges: {
        e_start_verify: edge("start_node", "verify", UNCOND),
        e_verify_ok: edge("verify", "triage", RESULT_OK),
        e_verify_fail: edge("verify", "deny", RESULT_FAIL),
        e_triage_inform: edge(
          "triage",
          "inform",
          llm("Quiere saber de sus reservaciones: cuáles tiene, cuándo o en qué estado están.", "inform"),
          back("tiene otra gestión"),
        ),
        e_triage_cancel: edge(
          "triage",
          "confirm_cancel",
          llm("Quiere cancelar una de SUS reservaciones.", "cancel"),
          back("ya no quiere cancelar"),
        ),
        e_triage_redirect: edge(
          "triage",
          "redirect_app",
          llm("Quiere cambiar fecha, hora o personas, u otra gestión que no es cancelar.", "redirect"),
        ),
        e_inform_cancel: edge(
          "inform",
          "confirm_cancel",
          llm("Decidió cancelar una de esas reservaciones.", "cancel"),
        ),
        e_inform_end: edge(
          "inform",
          "end_node",
          llm("Su duda quedó resuelta y ya te despediste.", "done"),
        ),
        e_cc_cancel: edge(
          "confirm_cancel",
          "do_cancel",
          llm("Confirmó explícitamente que sí cancela ESA reservación (lugar y fecha claros).", "confirmed"),
          RESULT_FAIL,
        ),
        e_dc_done: edge("do_cancel", "cancel_done", RESULT_OK),
        e_done_end: edge("cancel_done", "end_node", llm("Resuelto y despedido.", "done")),
        e_redirect_end: edge("redirect_app", "end_node", llm("Ya lo orientaste a la app y te despediste.", "done")),
        e_deny_code: edge(
          "deny",
          "code_lookup",
          llm("Dictó un código de referencia de 8 dígitos.", "has code"),
          RESULT_FAIL,
        ),
        e_deny_end: edge(
          "deny",
          "end_node",
          llm("No tiene código; ya lo invitaste a la app y te despediste.", "done"),
        ),
        e_code_info: edge("code_lookup", "code_info", RESULT_OK),
        e_ci_end: edge("code_info", "end_node", llm("Resuelto y despedido.", "done")),
      },
    },

    // a4 · verify venue → triage (upcoming / find-by-name / code lookup /
    // redirect) → shared results node → cancel with confirmation → close.
    a4: {
      prevent_subagent_loops: true,
      nodes: {
        start_node: { type: "start", position: pos(0, 0), edge_order: ["e_start_verify"] },
        verify: toolNode(a4Verify, pos(280, 0), ["e_verify_ok", "e_verify_fail"]),
        triage: talkNode({
          label: "Triage venue",
          position: pos(580, -160),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Lugar verificado. Saluda mencionando el nombre del lugar y pregunta en qué ayudas. Rutas: repasar sus reservaciones próximas · buscar por NOMBRE del comensal (el camino normal) · un código de referencia de 8 dígitos que dicten · otros cambios. Regla dura: solo hablas de reservaciones de SU lugar y NUNCA das el teléfono del comensal.",
          edgeOrder: ["e_triage_upcoming", "e_triage_find", "e_triage_code", "e_triage_redirect"],
        }),
        upcoming: talkNode({
          label: "Read upcoming",
          position: pos(920, -400),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Léeles las reservaciones próximas de SU lugar (de los tickets de la verificación): comensal, fecha, hora, personas, estado y código — breve. Si quieren cancelar una, AVANZA a la confirmación. Resuelto, despídete y cierra.",
          edgeOrder: ["e_upcoming_cancel", "e_upcoming_end"],
        }),
        find: toolNode(a4Find, pos(920, -160), ["e_find_found"]),
        code_lookup: toolNode(getRes, pos(920, 40), ["e_code_found"]),
        found: talkNode({
          label: "Present matches",
          position: pos(1240, -160),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Presenta las coincidencias: comensal, fecha, hora, personas y estado, con su código de referencia. Si quieren cancelar una, AVANZA a la confirmación; si solo era consulta y quedó resuelta, despídete y cierra. NUNCA des el teléfono del comensal.",
          edgeOrder: ["e_found_cancel", "e_found_end"],
        }),
        confirm_cancel: talkNode({
          label: "Confirm cancellation",
          position: pos(1560, -160),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Confirma UNA vez qué reservación cancelan (comensal, fecha y hora); el reference_code lo tomas tú del resultado — el restaurante no necesita dictarlo. Solo con un sí claro AVANZA a cancelar. Mesita le avisa al comensal; el restaurante NUNCA llama al cliente.",
          edgeOrder: ["e_cc_do"],
        }),
        do_cancel: toolNode(a4Cancel, pos(1880, -160), ["e_do_done"]),
        cancel_done: talkNode({
          label: "Cancelled — close",
          position: pos(2200, -160),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "La cancelación quedó registrada y Mesita le avisa al comensal. Confírmalo en una frase, ofrece algo más y, resuelto, despídete y cuelga con end_call.",
          edgeOrder: ["e_done_end"],
        }),
        redirect: talkNode({
          label: "Redirect to console",
          position: pos(920, 240),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Otros cambios (mover hora, capacidad, datos del lugar) no se hacen por esta línea: pídeles responder cuando Mesita los llame o usar su consola de Mesita. Despídete y cuelga con end_call.",
          edgeOrder: ["e_redirect_end"],
        }),
        deny: talkNode({
          label: "Unknown venue line",
          position: pos(580, 300),
          entryBehavior: "generate_immediately",
          additionalPrompt:
            "Caller verified=false. Di que ese número no está registrado como línea de ningún lugar en Mesita; pídeles llamar desde el teléfono registrado del negocio o escribir desde su consola de Mesita. No des NINGUNA información de reservaciones.",
          edgeOrder: ["e_deny_end"],
        }),
        end_node: { type: "end", position: pos(2520, 0), edge_order: [] },
      },
      edges: {
        e_start_verify: edge("start_node", "verify", UNCOND),
        e_verify_ok: edge("verify", "triage", RESULT_OK),
        e_verify_fail: edge("verify", "deny", RESULT_FAIL),
        e_triage_upcoming: edge(
          "triage",
          "upcoming",
          llm("Quieren repasar las reservaciones próximas de su lugar.", "upcoming"),
          back("otra gestión"),
        ),
        e_triage_find: edge(
          "triage",
          "find",
          llm("Buscan una reservación por el NOMBRE del comensal.", "find"),
          RESULT_FAIL,
        ),
        e_triage_code: edge(
          "triage",
          "code_lookup",
          llm("Dictan un código de referencia de Mesita de 8 dígitos.", "has code"),
          RESULT_FAIL,
        ),
        e_triage_redirect: edge(
          "triage",
          "redirect",
          llm("Piden otros cambios (mover hora, capacidad, datos) que no se hacen por esta línea.", "redirect"),
        ),
        e_upcoming_cancel: edge(
          "upcoming",
          "confirm_cancel",
          llm("Quieren cancelar una de esas reservaciones.", "cancel"),
        ),
        e_upcoming_end: edge("upcoming", "end_node", llm("Resuelto y despedido.", "done")),
        e_find_found: edge("find", "found", RESULT_OK, back("buscar otro nombre")),
        e_code_found: edge("code_lookup", "found", RESULT_OK),
        e_found_cancel: edge(
          "found",
          "confirm_cancel",
          llm("Quieren cancelar ESA reservación: el lugar ya no puede recibirla.", "cancel"),
          back("buscar otra u otra gestión"),
        ),
        e_found_end: edge("found", "end_node", llm("Solo era consulta; resuelto y despedido.", "done")),
        e_cc_do: edge(
          "confirm_cancel",
          "do_cancel",
          llm("Confirmaron explícitamente la cancelación de esa reservación.", "confirmed"),
          RESULT_FAIL,
        ),
        e_do_done: edge("do_cancel", "cancel_done", RESULT_OK),
        e_done_end: edge("cancel_done", "end_node", llm("Resuelto y despedido.", "done")),
        e_redirect_end: edge("redirect", "end_node", llm("Ya los orientaste y te despediste.", "done")),
        e_deny_end: edge(
          "deny",
          "end_node",
          llm("Ya explicaste que el número no está registrado y te despediste.", "done"),
        ),
      },
    },
  };
}

