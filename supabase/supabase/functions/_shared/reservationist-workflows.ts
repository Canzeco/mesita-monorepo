// The Reservationist fleet's workflow graphs, config-as-code: one per agent
// (a1..a4), built over the tool ids the workspace sync resolved. The agents
// and their tools are reservationist-fleet.ts. Keep the `venue_*` and
// "cancelled_by_venue" literals as they are: the live agents' prompts name
// them (see reservationist-fleet.ts).
//
// Procedures are Alpha — unused. Workflows only. Pushed by
// supabase-edgefunc-sync-reservationist mode "workflows".
// OpenAPI: top-level AgentWorkflowRequestModel { nodes, edges, prevent_subagent_loops }.
// Versioned agents: PATCH must target main via ?branch_id=… + version_description.

import type { FleetAgentKey } from "./reservationist-fleet.ts";

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

/** Live workspace tool ids the four graphs wire into their tool nodes. */
type FleetToolIds = {
  a1Report: string;
  a2Confirm: string;
  a2Cancel: string;
  a3Verify: string;
  a3Cancel: string;
  a4Verify: string;
  a4Find: string;
  a4Cancel: string;
  getRes: string;
};

function fleetToolIds(toolIdByName: Map<string, string>): FleetToolIds {
  return {
    a1Report: requireTool(toolIdByName, "a1_report_outcome"),
    a2Confirm: requireTool(toolIdByName, "a2_confirm_reservation"),
    a2Cancel: requireTool(toolIdByName, "a2_cancel_reservation"),
    a3Verify: requireTool(toolIdByName, "a3_verify_caller"),
    a3Cancel: requireTool(toolIdByName, "a3_cancel_reservation"),
    a4Verify: requireTool(toolIdByName, "a4_verify_caller"),
    a4Find: requireTool(toolIdByName, "a4_find_reservation"),
    a4Cancel: requireTool(toolIdByName, "a4_cancel_reservation"),
    getRes: requireTool(toolIdByName, "get_reservation"),
  };
}

// a1 · gatekeeper → negotiate → per-outcome report (confirmed / counter /
// declined) → tailored farewell → end. The three report nodes fire the
// SAME tool; the branch fixes the verdict context and the closing line.
function a1Workflow(t: FleetToolIds): FleetWorkflow {
  return {
    prevent_subagent_loops: true,
    nodes: {
      start_node: { type: "start", position: pos(0, 0), edge_order: ["e_start_book"] },
      // ONE talk node for the whole conversation with the place.
      //
      // There used to be a separate "gatekeeper" node in front of this one.
      // It broke real calls (conv_1201kz2cg6…, 2026-08-02): the agent
      // naturally answered "Sí, soy yo" by starting the booking ask, the
      // gatekeeper→book edge fired MID-SENTENCE, truncated it, and the call
      // died 4s later. Reaching the right person is a conversational nuance,
      // not a state — splitting it put a machine boundary inside one human
      // speech act. Every talk→talk hop is a chance to cut the agent off, so
      // a1 has none: the only transitions leave this node once the place has
      // actually answered.
      book: talkNode({
        label: "Book with place",
        position: pos(340, 0),
        entryBehavior: "generate_immediately",
        additionalPrompt:
          "Si {{call_context}} es \"modification\": NO pidas mesa nueva — el restaurante ya tiene una confirmada a nombre de {{guest_name}} el {{modification_of_date}} a las {{modification_of_time}}; pide MOVERLA a los nuevos datos y sigue las mismas ramas de booking (si no pueden, pide que cancelen la anterior y toma la rama declined). Si {{call_context}} es \"cancellation\": esta llamada NO pide mesa — el comensal {{guest_name}} CANCELA su reservación del {{reservation_date}} a las {{reservation_time}} (código Mesita {{reference_code}}). Da el aviso a quien conteste (a un buzón déjalo grabado igual), ofrece una disculpa breve de parte del comensal, agradece, despídete y cuelga con end_call — sin negociar y sin herramientas — y AVANZA por la rama de cancelación. Todo lo que sigue aplica solo al contexto \"booking\". Ya saludaste. Si quien contesta no toma reservaciones o es un conmutador, pide con cortesía que te pasen con quien sí; acepta esperas cortas. Luego pide la mesa: {{party_size}} personas, {{reservation_date}} a las {{reservation_time}}, a nombre de {{guest_name}}. Si piden teléfono de contacto da {{guest_phone}}; si piden número de confirmación, el código Mesita es {{reference_code}}. Menciona {{special_requests}} una sola vez si no está vacío y ya hay disponibilidad. Si no pueden tal cual, pregunta qué opciones cercanas tienen y apúntalas textuales y cortas — NO aceptes ninguna por tu cuenta, Mesita se las propone al comensal. No inventes disponibilidad. Quédate en esta conversación hasta que pase UNA de estas cinco cosas: confirmaron · ofrecieron alternativas · dijeron que no hay lugar · nunca llegaste con alguien que reserve (buzón, conmutador sin salida, «llame más tarde») · no es este restaurante. Ahí AVANZA por la rama que toque, sin despedirte todavía: el flujo registra el resultado.",
        edgeOrder: [
          "e_book_cancel_done",
          "e_book_confirmed",
          "e_book_counter",
          "e_book_declined",
          "e_book_unreachable",
          "e_book_wrong",
        ],
      }),
      report_confirmed: toolNode(t.a1Report, pos(940, -170), ["e_rc_farewell"]),
      report_counter: toolNode(t.a1Report, pos(940, 0), ["e_rco_farewell"]),
      report_declined: toolNode(t.a1Report, pos(940, 170), ["e_rd_farewell"]),
      // Weird-case reports. Same tool; the branch fixes the verdict.
      report_unreachable: toolNode(t.a1Report, pos(940, 340), ["e_ru_farewell"]),
      report_wrong: toolNode(t.a1Report, pos(940, 500), ["e_rw_farewell"]),
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
          "Las alternativas ya se registraron (verdict=counter_offer). Pide que POR FAVOR dejen apartadas esas opciones un momento mientras Mesita se las propone al comensal, y di que les regresas la respuesta enseguida. Ese apartado importa: si el comensal toma una de las opciones que ELLOS ofrecieron, Mesita la da por confirmada sin volver a llamar. Agradece, despídete corto y cuelga con end_call.",
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
      farewell_unreachable: talkNode({
        label: "Unreachable close",
        position: pos(1260, 340),
        entryBehavior: "generate_immediately",
        additionalPrompt:
          "Ya quedó registrado que no se pudo llegar con nadie que reserve (verdict=unreachable); Mesita lo reintenta más tarde. Si hay una persona en la línea, agradece en una frase y despídete. Si es un buzón o una grabadora, NO dejes recado ni datos del comensal: simplemente cuelga con end_call.",
        edgeOrder: ["e_fu_end"],
      }),
      farewell_wrong: talkNode({
        label: "Wrong number close",
        position: pos(1260, 500),
        entryBehavior: "generate_immediately",
        additionalPrompt:
          "Ya se registró que este número no es el restaurante (verdict=wrong_number). Discúlpate en una sola frase por la equivocación y cuelga con end_call. NO des el nombre del comensal, su teléfono ni ningún dato de la reservación — quien contestó no tiene nada que ver con Mesita.",
        edgeOrder: ["e_fw_end"],
      }),
      end_node: { type: "end", position: pos(1580, 0), edge_order: [] },
    },
    edges: {
      e_start_book: edge("start_node", "book", UNCOND),
      // Cancellation notices need no report tool — the ENGINE watches the
      // call and marks the notice delivered on "answered"; there is no
      // verdict to record. Straight to end once the aviso is out.
      e_book_cancel_done: edge(
        "book",
        "end_node",
        llm(
          "El contexto era cancellation: ya diste el aviso de cancelación, te despediste y colgaste.",
          "cancel notice done",
        ),
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
      // Weird cases. unreachable can be decided at first contact (voicemail,
      // IVR dead-end) or mid-negotiation (line dies, "llámenos luego").
      e_book_wrong: edge(
        "book",
        "report_wrong",
        llm(
          "Contestó una persona pero este número NO es el restaurante — es otro negocio o un particular.",
          "wrong number",
        ),
        RESULT_FAIL,
      ),
      e_book_unreachable: edge(
        "book",
        "report_unreachable",
        llm(
          "Nunca llegaste con alguien que pueda reservar: buzón de voz o grabadora, conmutador sin salida, demasiada espera, o te pidieron llamar más tarde.",
          "unreachable",
        ),
        RESULT_FAIL,
      ),
      e_rc_farewell: edge("report_confirmed", "farewell_ok", RESULT_OK),
      e_rco_farewell: edge("report_counter", "farewell_counter", RESULT_OK),
      e_rd_farewell: edge("report_declined", "farewell_declined", RESULT_OK),
      e_ru_farewell: edge("report_unreachable", "farewell_unreachable", RESULT_OK),
      e_rw_farewell: edge("report_wrong", "farewell_wrong", RESULT_OK),
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
      e_fu_end: edge(
        "farewell_unreachable",
        "end_node",
        llm("Ya cerraste (o era un buzón y no dejaste recado).", "done"),
      ),
      e_fw_end: edge(
        "farewell_wrong",
        "end_node",
        llm("Ya te disculpaste por la equivocación.", "done"),
      ),
    },
  };
}

// a2 · route by call_context (confirmation / counter_offer / voicemail) →
// dedicated presentation → confirm-or-cancel tools → tailored farewell.
function a2Workflow(t: FleetToolIds): FleetWorkflow {
  return {
    prevent_subagent_loops: true,
    nodes: {
      start_node: { type: "start", position: pos(0, 0), edge_order: ["e_start_talk"] },
      // ONE talk node, same lesson as a1: identity check and the two call
      // contexts are prompt-level branches, not states. Splitting them put a
      // machine boundary right after "sí, soy yo" — exactly where the agent
      // naturally keeps talking — and the transition truncated it.
      talk: talkNode({
        label: "Talk to guest",
        position: pos(340, 0),
        entryBehavior: "generate_immediately",
        additionalPrompt:
          "Ya saludaste. PRIMERO confirma con quién hablas: «¿hablo con {{guest_name}}?». Hasta que lo confirme, NO digas el restaurante, la fecha, la hora ni que existe una reservación — una reservación revela dónde va a estar una persona y a qué hora. Confirmado que es el comensal, sigue según {{call_context}}: si es confirmation, el restaurante YA CONFIRMÓ el {{reservation_date}} a las {{reservation_time}} para {{party_size}} — avísale y confirma los datos; si es counter_offer, el restaurante no pudo con esa hora y ofreció {{venue_alternatives}} — preséntalas tal cual, sin inventar ni prometer nada que el restaurante no dijo; si es reminder, la mesa YA está confirmada — recuérdale los datos (~3 h antes) y deja que confirme, pida un cambio o cancele. El comensal puede aceptar, elegir una alternativa, proponer otra fecha u hora (conviértela con {{system__time_utc}} como referencia), o cancelar: AVANZA por la rama que toque sin colgar. Si quien contesta NO es el comensal, o es un buzón de voz, toma su rama. Caso especial: si {{call_context}} es cancelled_by_venue, el restaurante CANCELÓ — tras confirmar identidad, avísale con tacto, discúlpate de parte de Mesita, dile que desde la app puede reservar otro lugar cuando quiera, NO llames ninguna herramienta, despídete cálido, cuelga con end_call y AVANZA por la rama de cancelación del restaurante.",
        edgeOrder: [
          "e_talk_venue_cancel_done",
          "e_talk_confirm",
          "e_talk_cancel",
          "e_talk_third_party",
          "e_talk_voicemail",
        ],
      }),
      third_party: talkNode({
        label: "Not the guest",
        position: pos(680, 400),
        entryBehavior: "generate_immediately",
        additionalPrompt:
          "No es el comensal quien contesta. NO reveles nada: ni el restaurante, ni la fecha, ni la hora, ni que hay una reservación. Di solamente que llamas de Mesita, que buscabas a {{guest_name}}, que no es urgente y que lo intentarás después o que puede revisar la app de Mesita. Si insisten en tomar recado, agradece y declina con amabilidad. Despídete y cuelga con end_call. No llames ninguna herramienta: el ticket no debe moverse por lo que diga un tercero.",
        edgeOrder: ["e_tp_end"],
      }),
      voicemail: talkNode({
        label: "Voicemail message",
        position: pos(640, 400),
        entryBehavior: "generate_immediately",
        additionalPrompt:
          "Es un buzón de voz: deja UN recado de una sola frase — que Mesita llamó por su reservación en {{venue_name}} y que puede revisar y confirmar en la app de Mesita — y cuelga con end_call. NO llames ninguna herramienta ni des más datos.",
        edgeOrder: ["e_vm_end"],
      }),
      do_confirm: toolNode(t.a2Confirm, pos(980, -180), ["e_dc_farewell"]),
      do_cancel: toolNode(t.a2Cancel, pos(980, 120), ["e_dx_farewell"]),
      farewell_done: talkNode({
        label: "Close (registered)",
        position: pos(1300, -180),
        entryBehavior: "generate_immediately",
        additionalPrompt:
          "Quedó registrado. Mira lo que regresó la herramienta y di SOLO eso: si confirmed_on_the_spot=true, la mesa YA quedó confirmada porque el comensal tomó una opción que el restaurante mismo había ofertado — díselo con esas palabras y NO prometas ninguna llamada más. Si parked=true, su petición quedó anotada y Mesita le confirma por la app, tampoco prometas llamada. En cualquier otro cambio de fecha u hora, explica que Mesita llama al restaurante para amarrarla y le confirma en cuanto quede. Despídete corto y cuelga con end_call.",
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
      e_start_talk: edge("start_node", "talk", UNCOND),
      // No tool on this branch: the ticket is already cancelled; the engine
      // marks the notice delivered by watching the call itself.
      e_talk_venue_cancel_done: edge(
        "talk",
        "end_node",
        llm(
          "El contexto era cancelled_by_venue: ya avisaste la cancelación al comensal, te despediste y colgaste.",
          "place-cancel notice done",
        ),
      ),
      e_talk_confirm: edge(
        "talk",
        "do_confirm",
        llm(
          "El comensal (ya identificado) aceptó tal cual, eligió una alternativa, o propuso otra fecha u hora — mándala en new_date AAAA-MM-DD / new_time HH:mm.",
          "confirm",
        ),
        RESULT_FAIL,
      ),
      e_talk_cancel: edge(
        "talk",
        "do_cancel",
        llm("El comensal (ya identificado) quiere cancelar la reservación.", "cancel"),
        RESULT_FAIL,
      ),
      e_talk_third_party: edge(
        "talk",
        "third_party",
        llm(
          "Contestó una persona que NO es el comensal: dice que no está, que es número equivocado, o se ofrece a tomar el recado.",
          "not the guest",
        ),
      ),
      e_talk_voicemail: edge(
        "talk",
        "voicemail",
        llm("Contestó un buzón de voz o una grabadora, no una persona.", "voicemail"),
      ),
      e_dc_farewell: edge("do_confirm", "farewell_done", RESULT_OK),
      e_dx_farewell: edge("do_cancel", "farewell_cancel", RESULT_OK),
      e_fdone_end: edge("farewell_done", "end_node", llm("Ya cerraste y te despediste.", "done")),
      e_fcancel_end: edge("farewell_cancel", "end_node", llm("Ya cerraste y te despediste.", "done")),
      e_vm_end: edge("voicemail", "end_node", llm("Ya dejaste el recado y colgaste.", "done")),
      e_tp_end: edge(
        "third_party",
        "end_node",
        llm("Ya cerraste sin revelar nada de la reservación.", "done"),
      ),
    },
  };
}

// a3 · verify → triage (inform / cancel-with-confirmation / redirect) on
// the verified lane; deny + reference-code lookup on the unverified lane.
function a3Workflow(t: FleetToolIds): FleetWorkflow {
  return {
    prevent_subagent_loops: true,
    nodes: {
      start_node: { type: "start", position: pos(0, 0), edge_order: ["e_start_verify"] },
      verify: toolNode(t.a3Verify, pos(280, 0), ["e_verify_ok", "e_verify_fail"]),
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
      do_cancel: toolNode(t.a3Cancel, pos(1220, -120), ["e_dc_done"]),
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
      code_lookup: toolNode(t.getRes, pos(900, 260), ["e_code_info"]),
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
  };
}

// a4 · verify place → triage (upcoming / find-by-name / code lookup /
// redirect) → shared results node → cancel with confirmation → close.
function a4Workflow(t: FleetToolIds): FleetWorkflow {
  return {
    prevent_subagent_loops: true,
    nodes: {
      start_node: { type: "start", position: pos(0, 0), edge_order: ["e_start_verify"] },
      verify: toolNode(t.a4Verify, pos(280, 0), ["e_verify_ok", "e_verify_fail"]),
      triage: talkNode({
        label: "Triage place",
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
      find: toolNode(t.a4Find, pos(920, -160), ["e_find_found"]),
      code_lookup: toolNode(t.getRes, pos(920, 40), ["e_code_found"]),
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
      do_cancel: toolNode(t.a4Cancel, pos(1880, -160), ["e_do_done"]),
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
          "Otros cambios (mover hora, capacidad, datos del lugar) no se hacen por esta línea: pídeles responder cuando Mesita los llame. Despídete y cuelga con end_call.",
        edgeOrder: ["e_redirect_end"],
      }),
      deny: talkNode({
        label: "Unknown place line",
        position: pos(580, 300),
        entryBehavior: "generate_immediately",
        additionalPrompt:
          "Caller verified=false. Di que ese número no está registrado como línea de ningún lugar en Mesita; pídeles llamar desde el teléfono registrado del negocio. No des NINGUNA información de reservaciones.",
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
  };
}

/**
 * Build the four fleet workflows (v2 — complex graphs). Tool nodes need live
 * workspace tool ids.
 *
 * Engine truths these graphs encode (supabase-edgefunc-place-reservation-call):
 * - a1: an ANSWERED call that ends without a1_report_outcome goes terminal
 *   (analysis fallback → declined/unresolved), so EVERY spoken path funnels
 *   through exactly one report tool node before the farewell — including the
 *   weird ones. Voicemail / IVR dead-end / "call back later" report
 *   `unreachable`, which the engine retries exactly like a no-answer; a line
 *   that isn't the place reports `wrong_number`, which is terminal on the spot
 *   because redialling would only ring the same stranger again.
 * - a2: tools fire only on explicit guest action; a voicemail message with no
 *   tool call is safe (ticket state simply doesn't move — same as no answer).
 *   It also verifies it is speaking to the guest BEFORE disclosing anything —
 *   a reservation reveals where someone will be at a given hour.
 * - a3/a4: inbound; identity rides system__caller_id bindings. get_reservation
 *   is the code-only lookup lane (response carries no phone numbers).
 */
export function fleetWorkflows(toolIdByName: Map<string, string>): Record<FleetAgentKey, FleetWorkflow> {
  const t = fleetToolIds(toolIdByName);
  return { a1: a1Workflow(t), a2: a2Workflow(t), a3: a3Workflow(t), a4: a4Workflow(t) };
}
