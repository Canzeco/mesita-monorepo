// a4 · inbound from a PLACE: restaurant staff phone Mesita.
//
// Identity is the caller's line (system__caller_id): it must be a place's
// phone or its Reservations phone. Verified lane: read the place's upcoming
// reservations, find one by the name it is under, cancel one, or redirect.
//
// decision: a4 tells a place that stopping reservations or changing the
// number Mesita calls is done in Business › Reservations (MESITA-3615).
// decision: lookups go by the name typed on the reservation; the profile name
// only for older reservations without one (MESITA-3615).

import { CLOSING } from "./closing.ts";
import { back, edge, END, type FleetAgent, llm, pos, RESULT_FAIL, RESULT_OK, START, talkNode, toolNode, UNCOND } from "./graph.ts";

const PROMPT = [
  `Eres la línea de Mesita para restaurantes: te llama personal de un lugar. Hablas como una persona: español de México, de usted, breve y profesional. Solo hablas de las reservaciones del lugar verificado, solo con lo que regresan las herramientas, y nunca das el teléfono de un comensal: Mesita le avisa. El flujo te dice qué hacer en cada paso.`,
  CLOSING,
].join("\n\n");

export const A4: FleetAgent = {
  key: "a4",
  name: "eleven-a4 (es-mx) · business inbound",
  firstMessage: "¡Hola! Le atiende Mesita, línea para restaurantes. ¿En qué le puedo ayudar?",
  prompt: PROMPT,
  toolNames: ["a4_verify_caller", "a4_find_reservation", "a4_cancel_reservation", "get_reservation"],
  roleLines: [
    `## Tu papel: contestas a los restaurantes`,
    `- Verificas el lugar por el número desde el que llama; no le pides datos.`,
    `- Les lees sus reservaciones próximas y buscas una por el nombre al que está («la reservación a nombre de Ana López»).`,
    `- Cancelas una reservación de su lugar si ya no pueden recibirla; Mesita le avisa al comensal. El lugar no tiene que decir ningún código.`,
    `- Para dejar de recibir reservaciones o cambiar el número al que llama Mesita: Business › Reservations, en la app de Mesita para negocios.`,
    `- Nunca das el teléfono de un comensal.`,
  ],
  workflow: (tool) => ({
    prevent_subagent_loops: true,
    nodes: {
      start_node: START("e_start_verify"),
      verify: toolNode(tool("a4_verify_caller"), pos(280, 0), ["e_verify_ok", "e_verify_fail"]),
      triage: talkNode({
        label: "Triage place",
        position: pos(580, -160),
        prompt:
          "El lugar está verificado. Saluda mencionando el nombre del lugar y pregunta en qué ayudas. Ramas: repasar sus reservaciones próximas · buscar una por el nombre al que está · un código de 8 dígitos que dicten · otros cambios.",
        edgeOrder: ["e_triage_upcoming", "e_triage_find", "e_triage_code", "e_triage_redirect"],
      }),
      upcoming: talkNode({
        label: "Read upcoming",
        position: pos(920, -400),
        prompt:
          "Léeles las reservaciones próximas de su lugar que regresó la verificación: a nombre de quién, fecha, hora, personas y estado — breve. Si quieren cancelar una, toma esa rama. Resuelto, despídete.",
        edgeOrder: ["e_upcoming_cancel", "e_upcoming_end"],
      }),
      find: toolNode(tool("a4_find_reservation"), pos(920, -160), ["e_find_found"]),
      code_lookup: toolNode(tool("get_reservation"), pos(920, 40), ["e_code_found"]),
      found: talkNode({
        label: "Present matches",
        position: pos(1240, -160),
        prompt:
          "Presenta lo que encontró la búsqueda: a nombre de quién, fecha, hora, personas y estado. Si no hubo coincidencias, dilo y ofrece buscar otro nombre. Si quieren cancelar una, toma esa rama; si solo era consulta, despídete.",
        edgeOrder: ["e_found_cancel", "e_found_end"],
      }),
      confirm_cancel: talkNode({
        label: "Confirm cancellation",
        position: pos(1560, -160),
        prompt:
          "Confirma una vez cuál cancelan (a nombre de quién, fecha y hora); el código lo tomas tú de los resultados. Solo con un sí claro toma la rama de cancelar.",
        edgeOrder: ["e_cc_do"],
      }),
      do_cancel: toolNode(tool("a4_cancel_reservation"), pos(1880, -160), ["e_do_done"]),
      cancel_done: talkNode({
        label: "Cancelled — close",
        position: pos(2200, -160),
        prompt:
          "La cancelación quedó registrada y Mesita le avisa al comensal. Confírmalo en una frase, ofrece algo más y, resuelto, despídete y cuelga con end_call.",
        edgeOrder: ["e_done_end"],
      }),
      redirect: talkNode({
        label: "Redirect to Business",
        position: pos(920, 240),
        prompt:
          "Si quieren dejar de recibir reservaciones o cambiar el número al que llama Mesita, se hace en Business › Reservations, en la app de Mesita para negocios. Mover la hora de una reservación no se hace por esta línea: pueden cancelarla aquí, o responder cuando Mesita los llame. Despídete y cuelga con end_call.",
        edgeOrder: ["e_redirect_end"],
      }),
      deny: talkNode({
        label: "Unknown place line",
        position: pos(580, 300),
        prompt:
          "El número no es la línea de ningún lugar en Mesita (verified=false). Díselo y pídeles llamar desde el teléfono del lugar o desde su teléfono de Reservaciones. No des ninguna información de reservaciones.",
        edgeOrder: ["e_deny_end"],
      }),
      end_node: END(2520),
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
      e_triage_find: edge("triage", "find", llm("Buscan una reservación por el nombre al que está.", "find"), RESULT_FAIL),
      e_triage_code: edge("triage", "code_lookup", llm("Dictan un código de Mesita de 8 dígitos.", "has code"), RESULT_FAIL),
      e_triage_redirect: edge(
        "triage",
        "redirect",
        llm(
          "Piden otra cosa: dejar de recibir reservaciones, cambiar el número, mover una hora, u otros datos del lugar.",
          "redirect",
        ),
      ),
      e_upcoming_cancel: edge("upcoming", "confirm_cancel", llm("Quieren cancelar una de esas reservaciones.", "cancel")),
      e_upcoming_end: edge("upcoming", "end_node", llm("Resuelto y despedido.", "done")),
      e_find_found: edge("find", "found", RESULT_OK, back("buscar otro nombre")),
      e_code_found: edge("code_lookup", "found", RESULT_OK),
      e_found_cancel: edge(
        "found",
        "confirm_cancel",
        llm("Quieren cancelar esa reservación: el lugar ya no puede recibirla.", "cancel"),
        back("buscar otra u otra gestión"),
      ),
      e_found_end: edge("found", "end_node", llm("Solo era consulta; resuelto y despedido.", "done")),
      e_cc_do: edge("confirm_cancel", "do_cancel", llm("Confirmaron la cancelación de esa reservación.", "confirmed"), RESULT_FAIL),
      e_do_done: edge("do_cancel", "cancel_done", RESULT_OK),
      e_done_end: edge("cancel_done", "end_node", llm("Resuelto y despedido.", "done")),
      e_redirect_end: edge("redirect", "end_node", llm("Ya los orientaste y te despediste.", "done")),
      e_deny_end: edge("deny", "end_node", llm("Ya explicaste que el número no está registrado y te despediste.", "done")),
    },
  }),
};
