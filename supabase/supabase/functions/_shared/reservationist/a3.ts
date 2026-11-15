// a3 · INBOUND: anyone phones Mesita's one number (MESITA-3974).
//
// Pato, 2026-11-14: "A3 AND A4 DON'T MAKE SENSE BECAUSE HOW THE FUCK DOES THE
// AGENT KNOWS WHO IS CALLING". It knows by the caller id: the first step,
// inbound_identify_caller, looks the number up in places and guests (never
// what the caller says) and the workflow branches. Since MESITA-4022 the
// branch is two tool steps, so the model never decides who is calling:
// inbound_identify_place, and on its failure inbound_identify_guest, then
// the unknown lane:
//   place   their upcoming book · find one by the name it is under · cancel
//           one · Business › Reservations for the rest
//   guest   their reservations · cancel one · the app for changes
//   both    lands in the place lanes; if they call about their own
//           reservation, one edge hops to the guest lanes
//   unknown (the lookup fails) one reservation by its 8-digit code, read-only
// The old a3 (guests) and a4 (places) were two agents on two lines; one line
// can answer with only one agent, so a callback to the wrong line failed.
//
// decision: a place's lookup is forgiving (MESITA-3956): name (misheard is
// fine), day, hour and party size each weigh in, best match first, read back
// once to confirm (_shared/reservation-search.ts).
// decision: lookups go by the name typed on the reservation (MESITA-3615); a
// dictated code is looked up by a4_find_reservation within the caller's place,
// never by the global get_reservation (MESITA-3622).
// decision: a place stops reservations or changes its number in Business ›
// Reservations, not by phone (MESITA-3615).

import { CLOSING, NATURAL } from "./closing.ts";
import { back, edge, END, type FleetAgent, llm, pos, RESULT_FAIL, RESULT_OK, START, talkNode, toolNode, UNCOND } from "./graph.ts";

const PROMPT = [
  `Eres la línea de reservaciones de Mesita: alguien te está llamando, un comensal o un restaurante. Quién llama lo dice el número, ya reconocido por el flujo; nunca lo que la persona diga. Hablas como una persona: español de México, de usted, natural y breve. Solo hablas de las reservaciones de quien llama y solo con lo que regresan las herramientas; nunca inventes reservaciones ni des datos de otras personas o de otros lugares. El flujo te dice qué hacer en cada paso.`,
  CLOSING,
  NATURAL,
].join("\n\n");

export const A3: FleetAgent = {
  key: "a3",
  name: "eleven-a3 (es-mx) · inbound · guests and restaurants",
  firstMessage: "¡Hola! Le atiende Mesita. ¿En qué le puedo ayudar?",
  prompt: PROMPT,
  toolNames: [
    "inbound_identify_place",
    "inbound_identify_guest",
    "a3_cancel_reservation",
    "a4_find_reservation",
    "a4_cancel_reservation",
    "get_reservation",
  ],
  roleLines: [
    `## Tu papel: contestas la línea de Mesita`,
    `- Te llaman comensales y restaurantes al mismo número. Sabes quién es por el número desde el que llama; no le pides datos para saberlo.`,
    `- A un comensal: le lees sus reservaciones y cancelas una suya si lo pide; cambiar día, hora, personas o lugar se hace en la app de Mesita.`,
    `- A un restaurante: le lees sus reservaciones próximas, buscas una con lo que te digan (el nombre al que está, aunque se oiga mal, el día, la hora, las personas, o el código si lo dictan) y cancelas una suya si ya no puede recibirla; Mesita le avisa al comensal. Dejar de recibir reservaciones o cambiar el número al que llama Mesita se hace en Business › Reservations.`,
    `- Si el número no es de nadie en Mesita, solo puedes leer una reservación por su código de 8 dígitos.`,
    `- Nunca das el teléfono de un comensal.`,
  ],
  workflow: (tool) => ({
    prevent_subagent_loops: true,
    nodes: {
      start_node: START("e_start_identify"),
      identify_place: toolNode(tool("inbound_identify_place"), pos(280, 0), ["e_idp_place", "e_idp_not"]),
      identify_guest: toolNode(tool("inbound_identify_guest"), pos(280, 320), ["e_idg_guest", "e_idg_unknown"]),
      triage_place: talkNode({
        label: "A place is calling",
        position: pos(600, -320),
        prompt: [
          "Llama un restaurante: el flujo lo reconoció por su número (inbound_identify_place). Tú eres Mesita; nunca hables como si fueras el restaurante.",
          "Salúdalo por su nombre (place.name), por ejemplo «¡Hola, Gran Central! ¿En qué le puedo ayudar?». Ten presentes sus notas (place.notes) y no preguntes lo que ya dicen.",
          "Si el resultado también trae guest (el número es de un restaurante y de un comensal) y no queda claro, pregunta una sola vez si llama por su restaurante o por una reservación suya.",
          "Luego toma la rama de lo que pidan. Para cancelar o revisar UNA reservación (por el nombre al que está, el día, la hora, las personas o su código), primero se busca: toma la rama de búsqueda; no respondas sin buscar.",
        ].join("\n"),
        edgeOrder: ["e_tp_upcoming", "e_tp_find", "e_tp_redirect", "e_tp_own"],
      }),
      triage_guest: talkNode({
        label: "A guest is calling",
        position: pos(600, 320),
        prompt: [
          "Llama un comensal: el flujo lo reconoció por su número. Sus datos y sus reservaciones están en guest del resultado.",
          "Si aún no lo saludaste, salúdalo por su nombre (guest.first_name) y pregunta en qué ayudas. Luego toma la rama de lo que pida.",
        ].join("\n"),
        edgeOrder: ["e_tg_inform", "e_tg_cancel", "e_tg_redirect"],
      }),

      // ── Place lane ────────────────────────────────────────────────────────
      place_upcoming: talkNode({
        label: "Place · read upcoming",
        position: pos(960, -480),
        prompt:
          "Léeles las reservaciones próximas de su restaurante, las que regresó el flujo: a nombre de quién, fecha, hora, personas y estado — breve. Si quieren cancelar una, toma esa rama. Resuelto, despídete.",
        edgeOrder: ["e_pu_cancel", "e_pu_end"],
      }),
      place_find: toolNode(tool("a4_find_reservation"), pos(960, -320), ["e_pf_found"]),
      place_found: talkNode({
        label: "Place · present matches",
        position: pos(1280, -320),
        prompt:
          "La búsqueda regresa las más parecidas, la mejor primero. Léeles la primera para confirmar que es esa: a nombre de quién, fecha, hora y personas, en una frase («¿Es la de Ana López, el viernes a las 8, para cuatro?»). Si dicen que no y hay otra, lee la siguiente. Si no hubo coincidencias, dilo una vez y pide otro dato (otro nombre, el día o la hora); no confirmes ni niegues reservaciones de otros lugares. Si quieren cancelar una (o ya lo pidieron al llamar), toma la rama de cancelar; no vuelvas a buscar la misma. Si solo era consulta, despídete.",
        edgeOrder: ["e_pfd_cancel", "e_pfd_end"],
      }),
      place_confirm_cancel: talkNode({
        label: "Place · confirm cancellation",
        position: pos(1600, -400),
        prompt:
          "Si ya confirmaron cuál es y pidieron cancelarla, no vuelvas a preguntar: toma la rama de cancelar. Si no, confirma una sola vez cuál cancelan (a nombre de quién, fecha y hora). El código lo tomas tú de los resultados. Solo con un sí claro toma la rama de cancelar.",
        edgeOrder: ["e_pcc_do"],
      }),
      place_do_cancel: toolNode(tool("a4_cancel_reservation"), pos(1920, -400), ["e_pdc_done"]),
      place_cancel_done: talkNode({
        label: "Place · cancelled",
        position: pos(2240, -400),
        prompt:
          "Quedó cancelada y Mesita le avisa al comensal. Dilo en una frase y, si no necesitan nada más, despídete y cuelga con end_call.",
        edgeOrder: ["e_pcd_end"],
      }),
      place_redirect: talkNode({
        label: "Place · Business › Reservations",
        position: pos(960, -160),
        prompt:
          "Dejar de recibir reservaciones o cambiar el número al que llama Mesita se hace en Business › Reservations, en la app de Mesita para negocios. Mover la hora de una reservación no se hace por esta línea: pueden cancelarla aquí, o responder cuando Mesita los llame. Dilo una vez, despídete y cuelga con end_call.",
        edgeOrder: ["e_pr_end"],
      }),

      // ── Guest lane ────────────────────────────────────────────────────────
      guest_inform: talkNode({
        label: "Guest · read reservations",
        position: pos(960, 160),
        prompt:
          "Léele sus reservaciones, las que regresó el flujo: lugar, fecha, hora, personas, a nombre de quién y estado — breve. Si decide cancelar una, toma esa rama. Resuelto, despídete.",
        edgeOrder: ["e_gi_cancel", "e_gi_end"],
      }),
      guest_confirm_cancel: talkNode({
        label: "Guest · confirm cancellation",
        position: pos(1280, 240),
        prompt:
          "Ubica la reservación por lugar y fecha; su código lo tomas tú de las reservaciones del comensal que regresó el flujo. Pregunta una sola vez: «¿Cancelo su reservación en X del día Y?». Solo con un sí claro toma la rama de cancelar.",
        edgeOrder: ["e_gcc_do"],
      }),
      guest_do_cancel: toolNode(tool("a3_cancel_reservation"), pos(1600, 240), ["e_gdc_done"]),
      guest_cancel_done: talkNode({
        label: "Guest · cancelled",
        position: pos(1920, 240),
        prompt:
          "Quedó cancelada y Mesita le avisa al restaurante. Dilo en una frase y, si no necesita nada más, despídete y cuelga con end_call.",
        edgeOrder: ["e_gcd_end"],
      }),
      guest_redirect: talkNode({
        label: "Guest · the app",
        position: pos(960, 400),
        prompt:
          "Cambiar día, hora, personas o lugar se hace desde la app de Mesita: dilo una vez con claridad, despídete y cuelga con end_call.",
        edgeOrder: ["e_gr_end"],
      }),

      // ── Unknown number ────────────────────────────────────────────────────
      unknown: talkNode({
        label: "Unknown number",
        position: pos(600, 640),
        prompt:
          "El número desde el que llaman no es de ningún comensal ni restaurante en Mesita. Dilo con amabilidad, una vez. A un comensal: con el código de 8 dígitos de su reservación puedes revisar esa; sin código, que la vea en la app de Mesita o que llame desde el número de su cuenta. A un restaurante: que llame desde el teléfono del lugar o desde su teléfono de Reservaciones. Sin código no das ningún dato ni confirmas que exista una reservación. No menciones correos ni otros medios que no sean esos. Si insiste, repítelo en una frase, discúlpate y despídete; no lo expliques más veces.",
        edgeOrder: ["e_un_code", "e_un_end"],
      }),
      code_lookup: toolNode(tool("get_reservation"), pos(960, 640), ["e_code_info"]),
      code_info: talkNode({
        label: "Code result",
        position: pos(1280, 640),
        prompt:
          "Di solo lo que regresó la búsqueda por código: lugar, fecha, hora, personas y estado de esa reservación. Para cambiarla o cancelarla: la app de Mesita, o llamar desde el número de su cuenta. No busques por nombre. Resuelto, despídete y cuelga con end_call.",
        edgeOrder: ["e_ci_end"],
      }),
      end_node: END(2560),
    },
    edges: {
      e_start_identify: edge("start_node", "identify_place", UNCOND),
      e_idp_place: edge("identify_place", "triage_place", RESULT_OK),
      e_idp_not: edge("identify_place", "identify_guest", RESULT_FAIL),
      e_idg_guest: edge("identify_guest", "triage_guest", RESULT_OK),
      e_idg_unknown: edge("identify_guest", "unknown", RESULT_FAIL),

      e_tp_upcoming: edge(
        "triage_place",
        "place_upcoming",
        llm("Quieren repasar las reservaciones próximas de su restaurante.", "upcoming"),
        back("otra gestión"),
      ),
      e_tp_find: edge(
        "triage_place",
        "place_find",
        llm(
          "Hablan de UNA reservación concreta — para cancelarla, revisarla o confirmarla — por el nombre al que está, el día, la hora, las personas o un código de 8 dígitos. Cancelar empieza aquí: primero se busca.",
          "find or cancel one",
        ),
        RESULT_FAIL,
      ),
      e_tp_redirect: edge(
        "triage_place",
        "place_redirect",
        llm("Piden otra cosa: dejar de recibir reservaciones, cambiar el número, mover una hora, u otros datos del lugar.", "redirect"),
      ),
      e_tp_own: edge(
        "triage_place",
        "triage_guest",
        llm("El resultado también trae guest y quien llama dijo que es por una reservación suya, no del restaurante.", "own reservation"),
      ),

      e_tg_inform: edge(
        "triage_guest",
        "guest_inform",
        llm("Quiere saber de sus reservaciones.", "inform"),
        back("tiene otra gestión"),
      ),
      e_tg_cancel: edge(
        "triage_guest",
        "guest_confirm_cancel",
        llm("Quiere cancelar una de sus reservaciones.", "cancel"),
        back("ya no quiere cancelar"),
      ),
      e_tg_redirect: edge(
        "triage_guest",
        "guest_redirect",
        llm("Quiere cambiar día, hora, personas o lugar, u otra gestión que no es cancelar.", "redirect"),
      ),

      e_pu_cancel: edge("place_upcoming", "place_confirm_cancel", llm("Quieren cancelar una de esas reservaciones.", "cancel")),
      e_pu_end: edge("place_upcoming", "end_node", llm("Resuelto y despedido.", "done")),
      // The way back re-runs the search, so it is a condition, never
      // unconditional: an always-open way back looped the call to death
      // (MESITA-4029).
      e_pf_found: edge(
        "place_find",
        "place_found",
        RESULT_OK,
        llm("Dieron OTRO dato (otro nombre, día, hora, personas o código), distinto de lo que ya se buscó.", "search again"),
      ),
      e_pfd_cancel: edge(
        "place_found",
        "place_confirm_cancel",
        llm("Quieren cancelar esa reservación: el lugar ya no puede recibirla.", "cancel"),
        back("buscar otra u otra gestión"),
      ),
      e_pfd_end: edge("place_found", "end_node", llm("Solo era consulta; resuelto y despedido.", "done")),
      e_pcc_do: edge("place_confirm_cancel", "place_do_cancel", llm("Confirmaron la cancelación de esa reservación.", "confirmed"), RESULT_FAIL),
      e_pdc_done: edge("place_do_cancel", "place_cancel_done", RESULT_OK),
      e_pcd_end: edge("place_cancel_done", "end_node", llm("Resuelto y despedido.", "done")),
      e_pr_end: edge("place_redirect", "end_node", llm("Ya los orientaste y te despediste.", "done")),

      e_gi_cancel: edge("guest_inform", "guest_confirm_cancel", llm("Decidió cancelar una de esas reservaciones.", "cancel")),
      e_gi_end: edge("guest_inform", "end_node", llm("Su duda quedó resuelta y ya te despediste.", "done")),
      e_gcc_do: edge(
        "guest_confirm_cancel",
        "guest_do_cancel",
        llm("Confirmó que sí cancela esa reservación (lugar y fecha claros).", "confirmed"),
        RESULT_FAIL,
      ),
      e_gdc_done: edge("guest_do_cancel", "guest_cancel_done", RESULT_OK),
      e_gcd_end: edge("guest_cancel_done", "end_node", llm("Resuelto y despedido.", "done")),
      e_gr_end: edge("guest_redirect", "end_node", llm("Ya lo orientaste a la app y te despediste.", "done")),

      e_un_code: edge("unknown", "code_lookup", llm("Dictó un código de 8 dígitos.", "has code"), RESULT_FAIL),
      e_un_end: edge("unknown", "end_node", llm("No tiene código; ya lo orientaste y te despediste.", "done")),
      e_code_info: edge("code_lookup", "code_info", RESULT_OK),
      e_ci_end: edge("code_info", "end_node", llm("Resuelto y despedido.", "done")),
    },
  }),
};
