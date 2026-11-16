// a1 · outbound to the PLACE: books (or moves, or cancels) a table for a guest.
//
// Call variables: venue_name, guest_name (the name typed on the reservation),
// party_size, reservation_date, reservation_time, special_requests (the
// guest's notes), venue_notes (place notes: what earlier calls taught about
// this place, MESITA-3955; may be empty), reference_code, run_id, call_context
// (booking | modification | cancellation | offer_release | change_declined),
// modification_of_date/_time, venue_alternatives (offer_release: the
// options; change_declined: the change the place asked for, MESITA-4073),
// window_from/window_to (the guest's time window, MESITA-3957; empty = exact)
// and seating ("adentro" · "afuera" · "en la barra"; empty = no preference).
// `venue_*` and "cancelled_by_venue" are wire keys the engine sends; they
// change only together with the engine (supabase-edgefunc-place-reservation-call).
//
// Engine truth this graph encodes: an ANSWERED call that ends without
// a1_report_outcome goes terminal on an analysis guess, so every spoken
// booking path funnels through exactly one report node before the farewell.
// unreachable is retried like a no-answer; wrong_number is terminal.
//
// decision: a1 never gives the guest's phone to the place — Mesita relays,
// same rule as a4 (MESITA-3615). The place calls back the line a1 dialed
// from, which a4 answers.

import { CLOSING, NATURAL } from "./closing.ts";
import {
  edge,
  END,
  type FleetAgent,
  llm,
  pos,
  RESULT_FAIL,
  RESULT_OK,
  START,
  talkNode,
  toolNode,
  UNCOND,
} from "./graph.ts";

const PROMPT = [
  `Eres el agente de reservaciones de Mesita. Llamas al restaurante {{venue_name}} de parte de un comensal de Mesita. Hablas como una persona: español de México, de usted, natural y breve. Nunca aceptes por tu cuenta algo distinto a lo que pidió el comensal, nunca inventes disponibilidad y nunca des el teléfono del comensal: Mesita es el contacto. El flujo te dice qué hacer en cada paso.`,
  CLOSING,
  NATURAL,
].join("\n\n");

const BOOK = [
  `La llamada ya está conectada con el restaurante y tu encargo ya está decidido ({{call_context}}): no lo preguntes ni lo anuncies. Lo primero que dices, en cuanto contesten, es exactamente: «¡Hola, buenas! Le llamo de Mesita por una reservación a nombre de {{guest_name}}.» Nada antes de esa frase. Si quien contesta no toma reservaciones o es un conmutador, pide con cortesía que te pasen con quien sí; acepta esperas cortas.`,
  `Según {{call_context}}:`,
  `- "booking": pide una mesa para {{party_size}} personas el {{reservation_date}} a las {{reservation_time}}, a nombre de {{guest_name}}. Si el comensal eligió dónde sentarse («{{seating}}») o sus notas ({{special_requests}}) piden un área o algo concreto (terraza, interior, barra, una silla para bebé), pídelo en esa misma frase: nunca digas que no hay preferencia si piden algo.`,
  `- "modification": el restaurante ya tiene una mesa a nombre de {{guest_name}} el {{modification_of_date}} a las {{modification_of_time}}. No pidas mesa nueva: pide moverla a {{party_size}} personas el {{reservation_date}} a las {{reservation_time}}. Si no pueden, pide que cancelen la anterior y toma la rama de no hay lugar.`,
  `- "cancellation": no pides mesa. Avisa que {{guest_name}} cancela su reservación del {{reservation_date}} a las {{reservation_time}} (si piden número, el código de Mesita es {{reference_code}}). A un buzón déjalo grabado igual. Ofrece una disculpa breve de parte del comensal, agradece, despídete, cuelga con end_call y toma la rama de aviso de cancelación.`,
  `- "offer_release": no pides mesa. Antes el restaurante ofreció opciones para {{guest_name}} ({{venue_alternatives}}) y le pediste que las apartara; el comensal no tomó ninguna. Avisa que ya pueden liberarlas (si piden número, el código de Mesita es {{reference_code}}). A un buzón déjalo grabado igual. Agradece, despídete, cuelga con end_call y toma la rama de aviso de cancelación.`,
  `- "change_declined": no pides mesa. Antes el restaurante le pidió a Mesita cambiar la reservación de {{guest_name}} a {{venue_alternatives}}; el comensal no aceptó el cambio (o no contestó a tiempo). Después del saludo di exactamente: «Le aviso que {{guest_name}} no aceptó el cambio a {{venue_alternatives}}, así que su reservación sigue como estaba: {{party_size}} personas el {{reservation_date}} a las {{reservation_time}}.» (si piden número, el código de Mesita es {{reference_code}}). Si dicen que así no pueden recibirla, di que pueden cancelarla llamando a Mesita a este mismo número y Mesita le avisa al comensal; tú no la cancelas. A un buzón déjalo grabado igual. Agradece, despídete, cuelga con end_call y toma la rama de aviso de cancelación.`,
  `Si piden un número de confirmación, el código de Mesita es {{reference_code}}. Si piden un teléfono de contacto, di que Mesita es el contacto y que pueden llamar de vuelta a este mismo número; no des el del comensal.`,
  `Las notas del comensal se dicen una sola vez, al pedir la mesa.`,
  `Lo que Mesita ya sabe de este restaurante por llamadas anteriores: «{{venue_notes}}». Si no está vacío, úsalo: no vuelvas a preguntar lo que ahí ya dice (por ejemplo, si tienen terraza) y sigue lo que indique para llegar con quien reserva. Si el restaurante dice hoy algo distinto, vale lo de hoy.`,
  `Lo que decides tú solo (MESITA-3957), sin consultar al comensal: adentro o afuera si «{{seating}}» está vacío, qué mesa, y pasar las notas. Si «{{window_from}}» no está vacío, el comensal acepta cualquier hora entre {{window_from}} y {{window_to}} del mismo día: si no hay a las {{reservation_time}} pero sí dentro de ese rango, acéptala y regístrala como confirmed con confirmed_time. También puedes aceptar un límite de tiempo en la mesa o una tolerancia de llegada; regístralos en terms y Mesita se lo dice al comensal.`,
  `Una reservación no lleva ningún pago en Mesita: nunca digas que el comensal paga un depósito, una garantía o un consumo mínimo en la app, en Wallet ni en ningún lado, ni que la mesa queda confirmada cuando pague. Si el restaurante pone una de esas condiciones, en cualquier momento de la llamada (también después de decir que sí), es una opción que decide el comensal: no la aceptes, di que se la consultas y que Mesita les confirma.`,
  `Si «{{window_from}}» no está vacío y te ofrecen una hora entre {{window_from}} y {{window_to}} del mismo día, esa hora la aceptas tú en ese momento, sin consultar a nadie: el comensal ya la aceptó. Regístrala como confirmed con confirmed_time.`,
  `Lo que NUNCA aceptas tú: una hora fuera de ese rango (o cualquier otra hora si el rango está vacío; ahí «¿se la aparto?» se contesta que no, que el comensal elige), otro día, barra o mesa compartida si el comensal no la pidió, un depósito, una garantía con tarjeta o un consumo mínimo. Tampoco cambias el número de personas ni el nombre, ni das el teléfono del comensal. Si eso es lo único que tienen, son opciones: apúntalas y el comensal decide.`,
  `Si no pueden tal cual ni dentro del rango, pregunta qué opciones cercanas tienen y apúntalas cortas y textuales. Tú nunca eliges ni aceptas una opción fuera del rango, ni pides que aparten solo una: el comensal decide. Si te ofrecen apartar una, di que el comensal elige y que Mesita les confirma en unos minutos.`,
  `Cuando ya tengas el resultado (confirmaron, ofrecieron opciones, no hay lugar), no digas nada más, ni gracias ni adiós: toma la rama en ese momento. El paso de cierre agradece y se despide una sola vez.`,
  `Quédate en la conversación hasta que pase una de estas cosas: confirmaron · ofrecieron opciones · no hay lugar · nunca llegaste con alguien que reserve · no es este restaurante. Entonces toma la rama, sin despedirte todavía: el flujo registra el resultado.`,
].join("\n");

export const A1: FleetAgent = {
  key: "a1",
  name: "eleven-a1 (es-mx) · c2b outbound booker",
  // Empty on purpose: a1 waits for the place to speak, then greets (the
  // greeting is the first line of BOOK). See TURN_OUTBOUND.
  firstMessage: "",
  prompt: PROMPT,
  toolNames: ["a1_report_outcome"],
  roleLines: [
    `## Tu papel: llamas a los restaurantes`,
    `- Pides la mesa a nombre del nombre y apellido escritos en la reservación, con el día, la hora, las personas y las notas del comensal.`,
    `- También mueves una reservación ya confirmada a otra hora, avisas que el comensal cancela, o avisas que ya pueden liberar las opciones que ofrecieron si el comensal no tomó ninguna.`,
    `- Decides solo lo pequeño: adentro o afuera, qué mesa, una hora dentro del rango que aceptó el comensal, un límite de tiempo o una tolerancia. Lo demás (otra hora fuera del rango, otro día, barra no pedida, depósito, garantía o consumo mínimo) lo decide el comensal.`,
    `- Registras el resultado: confirmada, otras opciones, no hay lugar, nadie que reserve, o número equivocado.`,
    `- Antes de cada llamada recibes las notas de Mesita sobre ese restaurante (lo aprendido en llamadas anteriores): no repites preguntas que las notas ya contestan.`,
    `- Nunca das el teléfono del comensal; si el lugar necesita algo, llama a Mesita a este mismo número.`,
  ],
  workflow: (tool) => {
    const report = tool("a1_report_outcome");
    const farewell = (label: string, y: number, prompt: string, out: string) =>
      talkNode({ label, position: pos(1260, y), prompt, edgeOrder: [out] });
    return {
      prevent_subagent_loops: true,
      nodes: {
        start_node: START("e_start_book"),
        book: talkNode({
          label: "Book with place",
          position: pos(340, 0),
          prompt: BOOK,
          edgeOrder: [
            "e_book_cancel_done",
            "e_book_confirmed",
            "e_book_counter",
            "e_book_declined",
            "e_book_unreachable",
            "e_book_wrong",
          ],
        }),
        report_confirmed: toolNode(report, pos(940, -170), ["e_rc_farewell"]),
        report_counter: toolNode(report, pos(940, 0), ["e_rco_farewell"]),
        report_declined: toolNode(report, pos(940, 170), ["e_rd_farewell"]),
        report_unreachable: toolNode(report, pos(940, 340), ["e_ru_farewell"]),
        report_wrong: toolNode(report, pos(940, 500), ["e_rw_farewell"]),
        farewell_ok: farewell(
          "Confirm & close",
          -170,
          "Si el registro regresó release_now=true, la reservación cambió mientras hablabas: no confirmes nada, di lo que indica su campo say (que ya no aparten la mesa), despídete y cuelga con end_call. Si no: la mesa quedó confirmada y registrada. Di una sola frase, por ejemplo «Perfecto, muchas gracias. ¡Hasta luego!», sin repetir datos y sin desearles buen provecho (hablas con el restaurante, no con el comensal), y cuelga con end_call. Si antes de colgar ponen una condición (depósito, garantía con tarjeta o consumo mínimo), no la aceptes ni digas que se paga en la app: di que se la comentas al comensal y que Mesita les confirma, despídete y cuelga.",
          "e_fok_end",
        ),
        farewell_counter: farewell(
          "Counter-offer close",
          0,
          "Si el registro regresó release_now=true, la reservación cambió mientras hablabas: di lo que indica su campo say (que ya no aparten las opciones), despídete y cuelga con end_call. Si no: las opciones quedaron registradas. En una o dos frases: pide que dejen apartadas las opciones que ofrecieron (todas, no una) un momento mientras el comensal elige; si toma una, queda confirmada sin volver a llamar. Si dicen que no pueden apartar todas o te ofrecen apartar solo una («¿le aparto la de las 9:30?»), NO aceptes ni elijas ninguna: di que el comensal elige y que Mesita les confirma en unos minutos, y que si no pueden apartarlas está bien. Agradece una vez, despídete y cuelga con end_call.",
          "e_fco_end",
        ),
        farewell_declined: farewell(
          "Declined close",
          170,
          "El resultado quedó registrado. Agradece el tiempo, despídete corto y cuelga con end_call.",
          "e_fd_end",
        ),
        farewell_unreachable: farewell(
          "Unreachable close",
          340,
          "Quedó registrado que no hubo con quién reservar; Mesita reintenta más tarde. Si hay una persona, agradece en una frase y despídete. Si es un buzón o una grabadora, no dejes recado ni datos del comensal: cuelga con end_call.",
          "e_fu_end",
        ),
        farewell_wrong: farewell(
          "Wrong number close",
          500,
          "Quedó registrado que no es el restaurante. Discúlpate en una frase y cuelga con end_call. No des el nombre del comensal ni ningún dato de la reservación.",
          "e_fw_end",
        ),
        end_node: END(1580),
      },
      edges: {
        e_start_book: edge("start_node", "book", UNCOND),
        // A cancellation notice records nothing: the engine marks it delivered
        // from the call's own status.
        e_book_cancel_done: edge(
          "book",
          "end_node",
          llm("El contexto era cancellation, offer_release o change_declined: ya diste el aviso, te despediste y colgaste.", "cancel notice done"),
        ),
        e_book_confirmed: edge("book", "report_confirmed", llm("El restaurante confirmó la mesa tal como se pidió, o a una hora dentro del rango que aceptó el comensal, SIN condiciones de pago. Si para esa mesa pide un depósito, una garantía con tarjeta o un consumo mínimo, NO es confirmada: es una opción para el comensal.", "confirmed"), RESULT_FAIL),
        e_book_counter: edge(
          "book",
          "report_counter",
          llm("El restaurante no puede tal cual y ofreció opciones concretas (otra hora u otra área), o solo da la mesa con un depósito, una garantía con tarjeta o un consumo mínimo (esa condición va en la nota de la opción).", "counter-offer"),
          RESULT_FAIL,
        ),
        e_book_declined: edge("book", "report_declined", llm("El restaurante dijo que no hay lugar ni opciones.", "declined"), RESULT_FAIL),
        e_book_unreachable: edge(
          "book",
          "report_unreachable",
          llm(
            "Nunca llegaste con alguien que pueda reservar: buzón o grabadora, conmutador sin salida, demasiada espera, o te pidieron llamar más tarde.",
            "unreachable",
          ),
          RESULT_FAIL,
        ),
        e_book_wrong: edge(
          "book",
          "report_wrong",
          llm("Contestó una persona pero este número no es el restaurante.", "wrong number"),
          RESULT_FAIL,
        ),
        e_rc_farewell: edge("report_confirmed", "farewell_ok", RESULT_OK),
        e_rco_farewell: edge("report_counter", "farewell_counter", RESULT_OK),
        e_rd_farewell: edge("report_declined", "farewell_declined", RESULT_OK),
        e_ru_farewell: edge("report_unreachable", "farewell_unreachable", RESULT_OK),
        e_rw_farewell: edge("report_wrong", "farewell_wrong", RESULT_OK),
        e_fok_end: edge("farewell_ok", "end_node", llm("Ya agradeciste y te despediste.", "done")),
        e_fco_end: edge("farewell_counter", "end_node", llm("Ya pediste que aparten las opciones y te despediste.", "done")),
        e_fd_end: edge("farewell_declined", "end_node", llm("Ya agradeciste y te despediste.", "done")),
        e_fu_end: edge("farewell_unreachable", "end_node", llm("Ya cerraste (o era un buzón y no dejaste recado).", "done")),
        e_fw_end: edge("farewell_wrong", "end_node", llm("Ya te disculpaste.", "done")),
      },
    };
  },
};
