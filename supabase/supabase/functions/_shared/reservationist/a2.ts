// a2 · outbound to the GUEST: tells them what the place said, or reminds them.
//
// Call variables: venue_name, guest_name, party_size, reservation_date,
// reservation_time, venue_alternatives, reference_code, run_id, call_context
// (confirmation | counter_offer | reminder | cancelled_by_venue).
//
// Engine truths: tools fire only on an explicit answer from the guest; a
// voicemail or a third party moves nothing (same as no answer). It confirms
// it is speaking to the guest BEFORE saying anything — a reservation reveals
// where someone will be and when.

import { CLOSING } from "./closing.ts";
import { edge, END, type FleetAgent, llm, pos, RESULT_FAIL, RESULT_OK, START, talkNode, toolNode, UNCOND } from "./graph.ts";

const PROMPT = [
  `Eres el agente de reservaciones de Mesita. Llamas a {{guest_name}}, un comensal de Mesita, por su reservación. Hablas como una persona: español de México, de usted, cálido y muy breve. Antes de decir cualquier dato confirma que hablas con {{guest_name}}. Nunca inventes disponibilidad ni prometas lo que el restaurante no dijo. El flujo te dice qué hacer en cada paso.`,
  CLOSING,
].join("\n\n");

const TALK = [
  `Ya saludaste. Primero confirma con quién hablas: «¿hablo con {{guest_name}}?». Hasta que lo confirme no digas el restaurante, la fecha, la hora ni que hay una reservación.`,
  `Confirmado, según {{call_context}}:`,
  `- "confirmation": {{venue_name}} confirmó la mesa para {{party_size}} el {{reservation_date}} a las {{reservation_time}}. Díselo y confirma los datos.`,
  `- "counter_offer": {{venue_name}} no pudo el {{reservation_date}} a las {{reservation_time}} y ofreció: {{venue_alternatives}}. Preséntalas tal cual.`,
  `- "reminder": la mesa en {{venue_name}} ya está confirmada para el {{reservation_date}} a las {{reservation_time}}. Recuérdale los datos.`,
  `- "cancelled_by_venue": {{venue_name}} tuvo que cancelar la reservación del {{reservation_date}} a las {{reservation_time}}. Díselo con tacto, discúlpate de parte de Mesita y dile que desde la app puede reservar en otro lugar. Despídete, cuelga con end_call y toma la rama de aviso de cancelación del restaurante.`,
  `El comensal puede aceptar, elegir una opción, proponer otra fecha u hora (conviértela con {{system__time_utc}} como referencia), o cancelar: toma la rama que toque sin colgar. Si contesta otra persona o un buzón, toma su rama. El código {{reference_code}} solo si lo pide.`,
].join("\n");

export const A2: FleetAgent = {
  key: "a2",
  name: "eleven-a2 (es-mx) · b2c outbound confirmer",
  firstMessage: "¡Hola, {{guest_name}}! Le llamo de Mesita por su reservación en {{venue_name}}.",
  prompt: PROMPT,
  toolNames: ["a2_confirm_reservation", "a2_cancel_reservation"],
  roleLines: [
    `## Tu papel: llamas a los comensales`,
    `- Les dices que el lugar confirmó, les presentas las opciones que ofreció, les recuerdas su mesa unas horas antes, o les avisas que el lugar canceló.`,
    `- El comensal puede aceptar, elegir una opción, pedir otra fecha u hora, o cancelar; tú lo registras.`,
    `- Si toma una opción que el lugar ya había ofrecido, la mesa queda confirmada ahí mismo. Si pide algo nuevo, Mesita llama al lugar y le confirma.`,
    `- Si no contesta el comensal, no das ningún dato.`,
  ],
  workflow: (tool) => ({
    prevent_subagent_loops: true,
    nodes: {
      start_node: START("e_start_talk"),
      talk: talkNode({
        label: "Talk to guest",
        position: pos(340, 0),
        prompt: TALK,
        edgeOrder: ["e_talk_venue_cancel_done", "e_talk_confirm", "e_talk_cancel", "e_talk_third_party", "e_talk_voicemail"],
      }),
      third_party: talkNode({
        label: "Not the guest",
        position: pos(680, 400),
        prompt:
          "No contestó el comensal. No reveles nada: ni el restaurante, ni la fecha, ni la hora, ni que hay una reservación. Di solo que llamas de Mesita, que buscabas a {{guest_name}} y que puede revisar la app de Mesita. No tomes recado. Despídete y cuelga con end_call.",
        edgeOrder: ["e_tp_end"],
      }),
      voicemail: talkNode({
        label: "Voicemail message",
        position: pos(640, 600),
        prompt:
          "Es un buzón de voz: deja un recado de una frase — que Mesita llamó por su reservación y que puede revisarla en la app de Mesita — y cuelga con end_call. No des más datos.",
        edgeOrder: ["e_vm_end"],
      }),
      do_confirm: toolNode(tool("a2_confirm_reservation"), pos(980, -180), ["e_dc_farewell"]),
      do_cancel: toolNode(tool("a2_cancel_reservation"), pos(980, 120), ["e_dx_farewell"]),
      farewell_done: talkNode({
        label: "Close (registered)",
        position: pos(1300, -180),
        prompt:
          "Quedó registrado. Di solo lo que regresó la herramienta: si confirmed_on_the_spot=true, la mesa ya quedó confirmada porque tomó una opción que el restaurante había ofrecido; si parked=true, su petición quedó anotada y Mesita le confirma por la app; si pidió otra fecha u hora, Mesita llama al restaurante y le confirma en cuanto quede. Despídete corto y cuelga con end_call.",
        edgeOrder: ["e_fdone_end"],
      }),
      farewell_cancel: talkNode({
        label: "Close (cancelled)",
        position: pos(1300, 120),
        prompt: "La cancelación quedó registrada. Lamenta brevemente, agradece y cuelga con end_call.",
        edgeOrder: ["e_fcancel_end"],
      }),
      end_node: END(1620),
    },
    edges: {
      e_start_talk: edge("start_node", "talk", UNCOND),
      // The reservation is already cancelled; the engine marks the notice
      // delivered from the call itself.
      e_talk_venue_cancel_done: edge(
        "talk",
        "end_node",
        llm("El contexto era cancelled_by_venue: ya avisaste, te despediste y colgaste.", "place-cancel notice done"),
      ),
      e_talk_confirm: edge(
        "talk",
        "do_confirm",
        llm(
          "El comensal (ya identificado) aceptó tal cual, eligió una opción, o propuso otra fecha u hora — mándala en new_date AAAA-MM-DD / new_time HH:mm.",
          "confirm",
        ),
        RESULT_FAIL,
      ),
      e_talk_cancel: edge("talk", "do_cancel", llm("El comensal (ya identificado) quiere cancelar la reservación.", "cancel"), RESULT_FAIL),
      e_talk_third_party: edge(
        "talk",
        "third_party",
        llm("Contestó una persona que no es el comensal: no está, número equivocado, o se ofrece a tomar recado.", "not the guest"),
      ),
      e_talk_voicemail: edge("talk", "voicemail", llm("Contestó un buzón de voz o una grabadora.", "voicemail")),
      e_dc_farewell: edge("do_confirm", "farewell_done", RESULT_OK),
      e_dx_farewell: edge("do_cancel", "farewell_cancel", RESULT_OK),
      e_fdone_end: edge("farewell_done", "end_node", llm("Ya cerraste y te despediste.", "done")),
      e_fcancel_end: edge("farewell_cancel", "end_node", llm("Ya cerraste y te despediste.", "done")),
      e_vm_end: edge("voicemail", "end_node", llm("Ya dejaste el recado y colgaste.", "done")),
      e_tp_end: edge("third_party", "end_node", llm("Ya cerraste sin revelar nada.", "done")),
    },
  }),
};
