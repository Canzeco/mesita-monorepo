// a1 · outbound to the PLACE: books (or moves, or cancels) a table for a guest.
//
// Call variables: venue_name, guest_name (the name typed on the reservation),
// party_size, reservation_date, reservation_time, special_requests (the
// guest's notes), reference_code, run_id, call_context
// (booking | modification | cancellation | offer_release),
// modification_of_date/_time, venue_alternatives (offer_release only).
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

import { CLOSING } from "./closing.ts";
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
].join("\n\n");

const BOOK = [
  `Ya saludaste. Si quien contesta no toma reservaciones o es un conmutador, pide con cortesía que te pasen con quien sí; acepta esperas cortas.`,
  `Según {{call_context}}:`,
  `- "booking": pide una mesa para {{party_size}} personas el {{reservation_date}} a las {{reservation_time}}, a nombre de {{guest_name}}.`,
  `- "modification": el restaurante ya tiene una mesa a nombre de {{guest_name}} el {{modification_of_date}} a las {{modification_of_time}}. No pidas mesa nueva: pide moverla a {{party_size}} personas el {{reservation_date}} a las {{reservation_time}}. Si no pueden, pide que cancelen la anterior y toma la rama de no hay lugar.`,
  `- "cancellation": no pides mesa. Avisa que {{guest_name}} cancela su reservación del {{reservation_date}} a las {{reservation_time}} (si piden número, el código de Mesita es {{reference_code}}). A un buzón déjalo grabado igual. Ofrece una disculpa breve de parte del comensal, agradece, despídete, cuelga con end_call y toma la rama de aviso de cancelación.`,
  `- "offer_release": no pides mesa. Antes el restaurante ofreció opciones para {{guest_name}} ({{venue_alternatives}}) y le pediste que las apartara; el comensal no tomó ninguna. Avisa que ya pueden liberarlas (si piden número, el código de Mesita es {{reference_code}}). A un buzón déjalo grabado igual. Agradece, despídete, cuelga con end_call y toma la rama de aviso de cancelación.`,
  `Si piden un número de confirmación, el código de Mesita es {{reference_code}}. Si piden un teléfono de contacto, di que Mesita es el contacto y que pueden llamar de vuelta a este mismo número; no des el del comensal.`,
  `Si {{special_requests}} no está vacío, menciónalo una sola vez cuando ya haya disponibilidad.`,
  `Si no pueden tal cual, pregunta qué opciones cercanas tienen y apúntalas cortas y textuales; no aceptes ninguna, Mesita se las propone al comensal.`,
  `Quédate en la conversación hasta que pase una de estas cosas: confirmaron · ofrecieron opciones · no hay lugar · nunca llegaste con alguien que reserve · no es este restaurante. Entonces toma la rama, sin despedirte todavía: el flujo registra el resultado.`,
].join("\n");

export const A1: FleetAgent = {
  key: "a1",
  name: "eleven-a1 (es-mx) · c2b outbound booker",
  firstMessage: "¡Hola, buenas! Le llamo de Mesita por una reservación a nombre de {{guest_name}}.",
  prompt: PROMPT,
  toolNames: ["a1_report_outcome"],
  roleLines: [
    `## Tu papel: llamas a los restaurantes`,
    `- Pides la mesa a nombre del nombre y apellido escritos en la reservación, con el día, la hora, las personas y las notas del comensal.`,
    `- También mueves una reservación ya confirmada a otra hora, avisas que el comensal cancela, o avisas que ya pueden liberar las opciones que ofrecieron si el comensal no tomó ninguna.`,
    `- Registras el resultado: confirmada, otras opciones, no hay lugar, nadie que reserve, o número equivocado.`,
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
          "La mesa quedó confirmada y registrada. Lee de vuelta en una frase: nombre, personas, fecha y hora. Agradece, despídete corto y cuelga con end_call.",
          "e_fok_end",
        ),
        farewell_counter: farewell(
          "Counter-offer close",
          0,
          "Las opciones quedaron registradas. Pide que por favor las dejen apartadas un momento mientras Mesita se las propone al comensal: si toma una de ellas, queda confirmada sin volver a llamar. Agradece, despídete corto y cuelga con end_call.",
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
          llm("El contexto era cancellation u offer_release: ya diste el aviso, te despediste y colgaste.", "cancel notice done"),
        ),
        e_book_confirmed: edge("book", "report_confirmed", llm("El restaurante confirmó la mesa tal como se pidió.", "confirmed"), RESULT_FAIL),
        e_book_counter: edge(
          "book",
          "report_counter",
          llm("El restaurante no puede tal cual y ofreció opciones concretas (otra hora u otra área).", "counter-offer"),
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
        e_fok_end: edge("farewell_ok", "end_node", llm("Ya leíste los datos de vuelta y te despediste.", "done")),
        e_fco_end: edge("farewell_counter", "end_node", llm("Ya pediste que aparten las opciones y te despediste.", "done")),
        e_fd_end: edge("farewell_declined", "end_node", llm("Ya agradeciste y te despediste.", "done")),
        e_fu_end: edge("farewell_unreachable", "end_node", llm("Ya cerraste (o era un buzón y no dejaste recado).", "done")),
        e_fw_end: edge("farewell_wrong", "end_node", llm("Ya te disculpaste.", "done")),
      },
    };
  },
};
