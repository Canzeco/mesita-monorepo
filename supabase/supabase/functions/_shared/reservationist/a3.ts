// a3 · inbound from a GUEST: a comensal phones Mesita.
//
// Identity is the caller's number (system__caller_id, bound on the tools) —
// never what the caller says. Verified lane: read their reservations, cancel
// one of theirs, or send them to the app for changes. Unverified lane: one
// reservation by its 8-digit code, read-only.

import { CLOSING } from "./closing.ts";
import { back, edge, END, type FleetAgent, llm, pos, RESULT_FAIL, RESULT_OK, START, talkNode, toolNode, UNCOND } from "./graph.ts";

const PROMPT = [
  `Eres la línea de Mesita para comensales: alguien te está llamando. Hablas como una persona: español de México, de usted, natural y breve. Solo hablas de las reservaciones del número verificado y solo con lo que regresan las herramientas; nunca inventes reservaciones ni des datos de otras personas. El flujo te dice qué hacer en cada paso.`,
  CLOSING,
].join("\n\n");

export const A3: FleetAgent = {
  key: "a3",
  name: "eleven-a3 (es-mx) · consumer inbound",
  firstMessage: "¡Hola! Le atiende Mesita, asistente de reservaciones. ¿En qué le puedo ayudar?",
  prompt: PROMPT,
  toolNames: ["a3_verify_caller", "a3_cancel_reservation", "get_reservation"],
  roleLines: [
    `## Tu papel: contestas a los comensales`,
    `- Verificas al comensal por el número desde el que llama; no le pides datos.`,
    `- Le lees sus reservaciones y cancelas una suya si lo pide. La ubicas por lugar y fecha; él no tiene que decir ningún código.`,
    `- Cambiar día, hora, personas o lugar se hace desde la app de Mesita.`,
    `- Si el número no tiene cuenta, solo puedes leer una reservación por su código de 8 dígitos.`,
  ],
  workflow: (tool) => ({
    prevent_subagent_loops: true,
    nodes: {
      start_node: START("e_start_verify"),
      verify: toolNode(tool("a3_verify_caller"), pos(280, 0), ["e_verify_ok", "e_verify_fail"]),
      triage: talkNode({
        label: "Triage guest",
        position: pos(580, -160),
        prompt:
          "El comensal está verificado (verified=true). Salúdalo por su nombre y pregunta en qué le ayudas. Usa solo las reservaciones que regresó la verificación. Según lo que pida, toma la rama: saber de sus reservaciones · cancelar una suya · otros cambios.",
        edgeOrder: ["e_triage_inform", "e_triage_cancel", "e_triage_redirect"],
      }),
      inform: talkNode({
        label: "Read their reservations",
        position: pos(900, -320),
        prompt:
          "Léele sus reservaciones: lugar, fecha, hora, personas, a nombre de quién y estado — breve. Si decide cancelar una, toma esa rama. Si ya quedó resuelto, despídete.",
        edgeOrder: ["e_inform_cancel", "e_inform_end"],
      }),
      confirm_cancel: talkNode({
        label: "Confirm cancellation",
        position: pos(900, -120),
        prompt:
          "Ubica la reservación por lugar y fecha; su código lo tomas tú de las reservaciones de la verificación. Pregunta una vez: «¿Cancelo su reservación en X del día Y?». Solo con un sí claro toma la rama de cancelar.",
        edgeOrder: ["e_cc_cancel"],
      }),
      do_cancel: toolNode(tool("a3_cancel_reservation"), pos(1220, -120), ["e_dc_done"]),
      cancel_done: talkNode({
        label: "Cancelled — close",
        position: pos(1540, -120),
        prompt:
          "La cancelación quedó hecha y Mesita le avisa al restaurante. Confírmalo en una frase, ofrece ayuda con algo más y, resuelto, despídete y cuelga con end_call.",
        edgeOrder: ["e_done_end"],
      }),
      redirect_app: talkNode({
        label: "Redirect to app",
        position: pos(900, 60),
        prompt:
          "Cambiar día, hora, personas o lugar se hace desde la app de Mesita: díselo con claridad, despídete y cuelga con end_call.",
        edgeOrder: ["e_redirect_end"],
      }),
      deny: talkNode({
        label: "Unknown caller",
        position: pos(580, 260),
        prompt:
          "El número no tiene cuenta (verified=false). Dile con amabilidad que no encuentras una cuenta de Mesita con el número desde el que llama. Si tiene el código de 8 dígitos de una reservación, puedes revisar esa; si no, invítalo a la app de Mesita. Sin código no das ningún dato.",
        edgeOrder: ["e_deny_code", "e_deny_end"],
      }),
      code_lookup: toolNode(tool("get_reservation"), pos(900, 260), ["e_code_info"]),
      code_info: talkNode({
        label: "Code result",
        position: pos(1220, 260),
        prompt:
          "Di solo lo que regresó la búsqueda por código: lugar, fecha, hora, personas y estado de esa reservación. Para cambiarla o cancelarla: la app de Mesita, o llamar desde el número de su cuenta. No busques por nombre. Resuelto, despídete y cuelga con end_call.",
        edgeOrder: ["e_ci_end"],
      }),
      end_node: END(1860),
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
        llm("Quiere cancelar una de sus reservaciones.", "cancel"),
        back("ya no quiere cancelar"),
      ),
      e_triage_redirect: edge(
        "triage",
        "redirect_app",
        llm("Quiere cambiar día, hora, personas o lugar, u otra gestión que no es cancelar.", "redirect"),
      ),
      e_inform_cancel: edge("inform", "confirm_cancel", llm("Decidió cancelar una de esas reservaciones.", "cancel")),
      e_inform_end: edge("inform", "end_node", llm("Su duda quedó resuelta y ya te despediste.", "done")),
      e_cc_cancel: edge(
        "confirm_cancel",
        "do_cancel",
        llm("Confirmó que sí cancela esa reservación (lugar y fecha claros).", "confirmed"),
        RESULT_FAIL,
      ),
      e_dc_done: edge("do_cancel", "cancel_done", RESULT_OK),
      e_done_end: edge("cancel_done", "end_node", llm("Resuelto y despedido.", "done")),
      e_redirect_end: edge("redirect_app", "end_node", llm("Ya lo orientaste a la app y te despediste.", "done")),
      e_deny_code: edge("deny", "code_lookup", llm("Dictó un código de 8 dígitos.", "has code"), RESULT_FAIL),
      e_deny_end: edge("deny", "end_node", llm("No tiene código; ya lo invitaste a la app y te despediste.", "done")),
      e_code_info: edge("code_lookup", "code_info", RESULT_OK),
      e_ci_end: edge("code_info", "end_node", llm("Resuelto y despedido.", "done")),
    },
  }),
};
