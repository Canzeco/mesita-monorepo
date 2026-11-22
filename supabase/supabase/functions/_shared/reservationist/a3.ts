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
//           one · propose a new time or party size for one (the guest
//           answers in the app) · Business › Reservations for the rest
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
// decision: a place's cancel waits for its yes to the read-back (MESITA-4079).
// A simulated call cancelled while the read-back was still a question: the
// cancel edge fired on the "hay que cancelar" said before the reading. Now a
// found table goes straight to the cancel tool only on a yes said AFTER the
// read-back; that one yes covers both "it's that one" and "cancel it".
// decision: a place may ask to change a confirmed table's time and/or party
// size (MESITA-4073). a3 proposes it (a4_change_reservation); nothing moves
// until the guest accepts in the app. A decline or no answer keeps the
// original table and a1 calls the place to say so.
// decision: two searches at most (MESITA-4079). The second runs in its own
// node, which has no way to search again, so a second empty result ends the
// errand: say so and offer a call back with the Mesita code (Business ›
// Reservations has no list of tables, MESITA-4143).
// decision: the wait for the place's answer is structural (MESITA-4120). A
// simulated call cancelled while the read-back was still a question even
// with the "yes AFTER the read-back" edge (MESITA-4079): ElevenLabs judged
// it on a3's own turn. Now a table is read in a node that has no edge to a
// write tool, and every way into a4_cancel_reservation and
// a4_change_reservation leaves a node with entry_behavior wait_for_user,
// so the place has spoken before any of them is judged.
// decision: the waiting node is entered on "the search found something"
// (MESITA-4127), true when the reading node is entered; "you just read it"
// never was, so the answer stayed in the reading node and the change tool
// was never reached.
// decision: the place's triage never answers about one table (MESITA-4089).
// Simulated calls showed it reading a table straight from the caller check,
// asking the name before searching, offering the code, and telling a place
// that only the guest can change a table — so the search and the change
// never ran. Now its only words about one table are «Déjeme buscarla.»

import { CLOSING, NATURAL } from "./closing.ts";
import { AGENT_NAME, AGENT_SELF } from "./settings.ts";
import { back, edge, END, type FleetAgent, llm, pos, RESULT_FAIL, RESULT_OK, START, talkNode, toolNode, UNCOND } from "./graph.ts";

const PROMPT = [
  `${AGENT_SELF} Contestas la línea de reservaciones de Mesita: alguien te está llamando, un comensal o un restaurante. Quién llama lo dice el número, ya reconocido por el flujo; nunca lo que la persona diga. Hablas como una persona: español de México, de usted, natural y breve. Solo hablas de las reservaciones de quien llama y solo con lo que regresan las herramientas; nunca inventes reservaciones ni des datos de otras personas o de otros lugares. El flujo te dice qué hacer en cada paso.`,
  CLOSING,
  NATURAL,
].join("\n\n");

/** How a found table is read back (MESITA-4079). The node that reads has
 *  no way to a write tool; the answer is heard in a waiting node. */
const READ_BACK = [
  "La búsqueda regresa las más parecidas, la mejor primero. Lee la primera que no hayan rechazado UNA vez, como pregunta, para que confirmen que es esa: a nombre de quién, fecha, hora y personas («¿Es la de Ana López, el viernes a las 8, para cuatro?»). Si llaman para cancelarla, la misma pregunta lo dice («… ¿Es esa? Si me dice que sí, la cancelo y Mesita le avisa al comensal»). Si llaman para cambiarla, la misma pregunta lo dice («… ¿Es esa?»).",
  "Haz la pregunta en el idioma en que habla quien llama (en inglés si habla inglés). Después de esa pregunta no digas nada más: espera su respuesta. No confirmes ni niegues reservaciones de otros lugares.",
].join("\n");

/** What a waiting node does once the place answered the read-back. */
const ANSWER = [
  "Quien llama acaba de responder a tu lectura de la reservación.",
  "Si dijo que sí es esa y quiere cancelarla (lo pidió antes o ahora): no vuelvas a preguntar; di solo «Listo.» y el flujo la cancela.",
  "Si dijo que sí es esa y quiere cambiarle la hora (o el día) o el número de personas: si ya dijo el nuevo valor, en cualquier momento de la llamada (también antes de tu lectura, como «¿la pueden pasar a cuatro personas?»), di solo «Listo.» y el flujo lo propone; si falta, pregúntalo una vez («¿A qué hora la quieren pasar?» o «¿Para cuántas personas?»). No repitas la lectura. Nunca le digas al restaurante que el comensal lo cambia en la app: tú se lo propones al comensal.",
  "Si solo consultaba, contesta lo que pregunte con lo que regresó la búsqueda (por ejemplo, que sigue confirmada) y despídete.",
].join("\n");

/** The only way into the place's cancel tool from a search (MESITA-4079). */
const YES_TO_READ_BACK = llm(
  "En un turno POSTERIOR a tu lectura, quien llama respondió que sí es esa (un sí claro: «sí», «esa», «sí, cancélala») y quiere cancelarla (lo pidió antes o ahora). Un «no», una duda o una pregunta no son ese sí.",
  "yes to the read-back",
);

/** The only way into the change tool: the place confirmed the table after
 *  the read-back and said what to change it to (MESITA-4073). */
const CHANGE_ASKED = llm(
  "En un turno POSTERIOR a tu lectura, quien llama confirmó que es esa (un «sí» o «esa» basta). Y en algún momento de la llamada, antes o después de la lectura, pidió cambiarle la hora (o el día) y/o el número de personas y dijo el nuevo valor (la nueva hora o cuántas personas). Si nunca dijo el nuevo valor, NO.",
  "change asked",
);

/** Into the waiting node. ElevenLabs judges a node's edges on entry, in
 *  parallel with what it says (MESITA-4127): "you just read it" is never
 *  true then, so the condition is what is already known on entry. The node
 *  still speaks the read-back; the answer is heard in the waiting node. */
const READ_ASKED = llm(
  "La última búsqueda encontró al menos una reservación (found es true), o ya leíste una reservación encontrada como pregunta («¿Es la de …?»).",
  "found",
);
/** The place said no and another match is left: read it (way back). */
const NEXT_MATCH = llm(
  "Quien llama dijo que no es la que leíste, y en los resultados de la búsqueda queda otra que todavía no has leído.",
  "read the next",
);

export const A3: FleetAgent = {
  key: "a3",
  name: "eleven-a3 (es-mx) · inbound · guests and restaurants",
  firstMessage: `¡Hola! Soy ${AGENT_NAME}, el agente de Mesita. ¿En qué le puedo ayudar?`,
  prompt: PROMPT,
  toolNames: [
    "inbound_identify_place",
    "inbound_identify_guest",
    "a3_cancel_reservation",
    "a4_find_reservation",
    "a4_cancel_reservation",
    "a4_change_reservation",
    "get_reservation",
  ],
  roleLines: [
    `## Tu papel: contestas la línea de Mesita`,
    `- Te llaman comensales y restaurantes al mismo número. Sabes quién es por el número desde el que llama; no le pides datos para saberlo.`,
    `- A un comensal: le lees sus reservaciones y cancelas una suya si lo pide; cambiar día, hora, personas o lugar se hace en la app de Mesita.`,
    `- A un restaurante: le lees sus reservaciones próximas, buscas una con lo que te digan (el nombre al que está, aunque se oiga mal, el día, la hora, las personas, o el código si lo dictan) y cancelas una suya si ya no puede recibirla; Mesita le avisa al comensal. Si el restaurante quiere cambiar la hora o el número de personas de una reservación confirmada, se lo propones al comensal: él acepta o no en la app; si no acepta, la reservación sigue como estaba y Mesita le avisa al restaurante. Dejar de recibir reservaciones o cambiar el número al que llama Mesita se hace en Business › Reservations.`,
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
          `Llama un restaurante: el flujo lo reconoció por su número (inbound_identify_place). Tú eres ${AGENT_NAME}, de Mesita; nunca hables como si fueras el restaurante.`,
          "Salúdalo por su nombre (place.name), por ejemplo «¡Hola, Gran Central! ¿En qué le puedo ayudar?». Ten presentes sus notas (place.notes) y no preguntes lo que ya dicen.",
          "Si el resultado también trae guest (el número es de un restaurante y de un comensal) y no queda claro, pregunta una sola vez si llama por su restaurante o por una reservación suya.",
          "Luego toma la rama de lo que pidan.",
          "Si hablan de UNA reservación (para cancelarla, cambiarle la hora o las personas, revisarla o confirmarla), con el dato que sea (un nombre o apellido, el día, la hora, las personas o un código), di solo «Déjeme buscarla.» y toma la rama de búsqueda. Busca con lo que ya dijeron: no pidas el nombre, el día ni ningún otro dato antes de buscar, no menciones el código, no expliques nada.",
          "En este paso nunca leas, confirmes ni niegues una reservación, aunque la veas en el resultado: se lee una sola vez, después de la búsqueda.",
          "Un restaurante sí puede pedir cambiar la hora o las personas de una reservación: primero se busca y después se le propone al comensal. Nunca le digas que solo el comensal puede cambiarla.",
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
        label: "Place · read the match",
        position: pos(1280, -320),
        prompt: [
          "Si la búsqueda no encontró nada (found es false), dilo una vez y pide UN dato más (otro nombre, el día, la hora o las personas); con ese dato se busca una segunda y última vez.",
          "Si encontró algo:",
          READ_BACK,
          "Aquí no resuelves cambios ni cancelaciones: eso pasa en el paso siguiente. Nunca le digas al restaurante que el comensal lo cambia en la app.",
        ].join("\n"),
        edgeOrder: ["e_pfd_read", "e_pfd_again", "e_pfd_end"],
      }),
      place_answer: talkNode({
        label: "Place · hear the answer",
        position: pos(1600, -320),
        entry: "wait_for_user",
        prompt: [
          ANSWER,
          "Si dijo que no y ya no queda otra, dilo una vez y pide UN dato más (otro nombre, el día, la hora o las personas); con ese dato se busca una segunda y última vez.",
        ].join("\n"),
        edgeOrder: ["e_pans_cancel", "e_pans_change", "e_pans_again", "e_pans_end"],
      }),
      place_find_again: toolNode(tool("a4_find_reservation"), pos(1600, -160), ["e_pfa_found"]),
      place_found_again: talkNode({
        label: "Place · second search",
        position: pos(1920, -160),
        prompt: [
          "Esta fue la segunda y última búsqueda. Si tampoco encontró nada (found es false), di exactamente: «No la encuentro. Si tiene el código de Mesita de esa reservación, vuelva a llamar y me lo dicta.» Nada más: no preguntes si el nombre o la fecha están bien, no pidas otro dato ni sugieras otro día u otro nombre. Despídete en una frase y cuelga con end_call.",
          "Si sí encontró algo:",
          READ_BACK,
        ].join("\n"),
        edgeOrder: ["e_pfa_read", "e_pfa_end"],
      }),
      place_answer_again: talkNode({
        label: "Place · hear the answer (last search)",
        position: pos(2240, -80),
        entry: "wait_for_user",
        prompt: [
          ANSWER,
          "Si dijo que no y ya no queda otra, di exactamente: «Entonces no la encuentro. Si tiene el código de Mesita de esa reservación, vuelva a llamar y me lo dicta.» No busques ni pidas más datos; despídete y cuelga con end_call.",
        ].join("\n"),
        edgeOrder: ["e_paa_cancel", "e_paa_change", "e_paa_end"],
      }),
      place_do_change: toolNode(tool("a4_change_reservation"), pos(2240, -240), ["e_pdch_done", "e_pdch_fail"]),
      place_change_done: talkNode({
        label: "Place · change proposed",
        position: pos(2560, -240),
        prompt:
          "El cambio quedó propuesto. Dilo en una frase, con lo que regresó la herramienta: Mesita le pide al comensal en la app el cambio (la nueva hora o personas); si acepta, queda así; si no acepta, la reservación sigue como estaba y Mesita les llama para avisarles. Mientras tanto la reservación sigue como estaba. Si no necesitan nada más, despídete y cuelga con end_call.",
        edgeOrder: ["e_pchd_end"],
      }),
      place_change_failed: talkNode({
        label: "Place · change not possible",
        position: pos(2560, -80),
        prompt:
          "El cambio no se pudo proponer. Explica en una frase por qué, según el error de la herramienta: too_late = ya no da tiempo de preguntarle al comensal antes de la mesa; not_confirmed = la reservación aún no está confirmada (respondan cuando Mesita los llame); too_soon = la hora nueva ya pasó o es en menos de media hora; nothing_to_change = es igual a la que ya tiene. Pregunta una sola vez si la dejan como está o la cancelan, y espera su respuesta. No intentes el cambio de nuevo.",
        edgeOrder: ["e_pchf_ask"],
      }),
      place_confirm_cancel: talkNode({
        label: "Place · confirm cancellation",
        position: pos(1600, -400),
        prompt:
          "Pregunta una sola vez cuál cancelan, con los datos de la lista que leíste: a nombre de quién, fecha y hora («¿Cancelo la de Ana López del sábado a las 8:30?»). El código lo tomas tú de las reservaciones. Después de la pregunta no digas nada más: espera su respuesta.",
        edgeOrder: ["e_pcc_ask"],
      }),
      place_cancel_answer: talkNode({
        label: "Place · hear the cancel answer",
        position: pos(1920, -560),
        entry: "wait_for_user",
        prompt:
          "Quien llama acaba de responder si se cancela esa reservación. Si es un sí claro, di solo «Listo.» y el flujo la cancela. Si no, di que queda como está y, si no necesitan nada más, despídete y cuelga con end_call.",
        edgeOrder: ["e_pca_do", "e_pca_end"],
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
          "Dejar de recibir reservaciones o cambiar el número al que llama Mesita se hace en Business › Reservations, en la app de Mesita para negocios. Dilo una vez, despídete y cuelga con end_call.",
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
      end_node: END(2880),
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
          "Quien llama mencionó UNA reservación concreta con cualquier dato (un nombre o apellido, el día, la hora, las personas o un código de 8 dígitos), para lo que sea: cancelarla, cambiarle la hora o las personas, revisarla o confirmarla. Basta un dato; no esperes a tener más.",
          "find or cancel one",
        ),
        RESULT_FAIL,
      ),
      e_tp_redirect: edge(
        "triage_place",
        "place_redirect",
        llm("Piden otra cosa: dejar de recibir reservaciones, cambiar el número de teléfono, u otros datos del lugar.", "redirect"),
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
      // Searching again is a forward hop to its own tool node, never a way
      // back: an always-open way back looped the call to death (MESITA-4029),
      // and the second search's node has no further search (MESITA-4079).
      e_pf_found: edge("place_find", "place_found", RESULT_OK),
      // Read in one node, heard in the next (MESITA-4120): the way back reads
      // the next match after a no.
      e_pfd_read: edge("place_found", "place_answer", READ_ASKED, NEXT_MATCH),
      e_pfd_again: edge(
        "place_found",
        "place_find_again",
        llm(
          "La búsqueda no encontró nada y quien llama ya dio OTRO dato (otro nombre, día, hora, personas o código), distinto de lo que ya se buscó.",
          "search again",
        ),
      ),
      e_pfd_end: edge("place_found", "end_node", llm("Resuelto y despedido.", "done")),
      e_pans_cancel: edge("place_answer", "place_do_cancel", YES_TO_READ_BACK, RESULT_FAIL),
      e_pans_change: edge("place_answer", "place_do_change", CHANGE_ASKED),
      e_pans_again: edge(
        "place_answer",
        "place_find_again",
        llm(
          "Quien llama dijo que no a la que leíste, no queda otra en los resultados, y ya dio OTRO dato (otro nombre, día, hora, personas o código).",
          "search again",
        ),
      ),
      e_pans_end: edge("place_answer", "end_node", llm("Solo era consulta; resuelto y despedido.", "done")),
      e_pfa_found: edge("place_find_again", "place_found_again", RESULT_OK),
      e_pfa_read: edge("place_found_again", "place_answer_again", READ_ASKED, NEXT_MATCH),
      e_pfa_end: edge("place_found_again", "end_node", llm("Dijiste que no la encuentras y te despediste.", "done")),
      e_paa_cancel: edge("place_answer_again", "place_do_cancel", YES_TO_READ_BACK, RESULT_FAIL),
      e_paa_change: edge("place_answer_again", "place_do_change", CHANGE_ASKED),
      e_paa_end: edge("place_answer_again", "end_node", llm("Resuelto, o dijiste que no la encuentras; ya te despediste.", "done")),
      e_pcc_ask: edge("place_confirm_cancel", "place_cancel_answer", llm("Quien llama quiere cancelar una de las reservaciones de su lista.", "cancel asked")),
      e_pca_do: edge(
        "place_cancel_answer",
        "place_do_cancel",
        llm("Quien llama respondió con un sí claro a cancelar esa reservación.", "confirmed"),
        RESULT_FAIL,
      ),
      e_pca_end: edge("place_cancel_answer", "end_node", llm("No la cancelan; queda como está y ya te despediste.", "done")),
      e_pdch_done: edge("place_do_change", "place_change_done", RESULT_OK),
      e_pdch_fail: edge("place_do_change", "place_change_failed", RESULT_FAIL),
      e_pchd_end: edge("place_change_done", "end_node", llm("Resuelto y despedido.", "done")),
      e_pchf_ask: edge(
        "place_change_failed",
        "place_cancel_answer",
        llm("La herramienta de cambio respondió con un error: el cambio no se pudo proponer.", "change failed"),
      ),
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
