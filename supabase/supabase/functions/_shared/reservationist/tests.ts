// The reservation agents' simulated-call tests (MESITA-3967).
//
// Pato, 2026-11-14: "Can you create tests with the MCP??" … "in the mesita
// monorepo i wnat shit". Each entry is one ElevenLabs simulation test: a
// simulated caller acts out `scenario` against the agent, and an evaluator
// judges the conversation against every line of `conditions`.
// supabase-edgefunc-sync-reservationist pushes them (mode "tests"), runs them
// (mode "run_tests") and reads a run back (mode "test_results").
//
// Every tool is mocked in a test, so a run never writes to a reservation.
// A simulation is text: it cannot hear the pause before the greeting or a
// spoken interruption; those need a real call.
//
// The first set is the manner Pato asked for on 2026-11-14: confirm once,
// say each thing once, switch to English, never accept another hour, never
// give the guest's phone, use the place notes, identity before details.

import type { FleetAgentKey } from "./graph.ts";
import type { ToolName } from "./tools.ts";

export type FleetTest = {
  agent: FleetAgentKey;
  /** Short English label; the pushed name is `${TEST_PREFIX} · a1 · label`. */
  label: string;
  /** Who the simulated caller is and how they behave. */
  scenario: string;
  /** Every line must hold for the test to pass. */
  conditions: string[];
  /** The call variables the engine would send. */
  variables?: Record<string, string | number>;
  maxTurns?: number;
  /** What each tool answers in this test, as the real Edge Function would
   *  (JSON text). A tool not listed gets ElevenLabs' generic mock. */
  mocks?: Partial<Record<ToolName, string>>;
  /** Tools whose mock answers as a failure (the real function's 4xx). */
  failing?: ToolName[];
};

/** Every pushed test starts with this, so the sync only ever touches its own. */
export const TEST_PREFIX = "mesita";

export function testName(t: FleetTest): string {
  return `${TEST_PREFIX} · ${t.agent} · ${t.label}`;
}

/** Ana López's table at Gran Central, as the tools speak it. */
const ANA_TICKET = {
  reference_code: "48213907",
  guest_name: "Ana López",
  place_name: "Gran Central",
  date_es: "sábado 21 de noviembre",
  time_es: "8:30 p.m.",
  reserved_at: "2026-11-22T02:30:00.000Z",
  party_size: 2,
  state: "confirmed",
  notes: null,
  is_test: false,
};
const mock = (v: unknown) => JSON.stringify(v);
/** What the two identify tools answer (MESITA-3974, MESITA-4022). */
const GUEST_ANA = mock({
  ok: true,
  kind: "guest",
  guest: { name: "Ana López", first_name: "Ana", tickets: [ANA_TICKET] },
});
const PLACE_GRAN_CENTRAL = mock({
  ok: true,
  kind: "place",
  place: { name: "Gran Central", notes: "", tickets: [ANA_TICKET] },
});
/** An unknown number: the real function answers 404, a failed tool. */
const UNKNOWN_NUMBER = mock({ ok: false, kind: "unknown", reason: "no Mesita place or account with this number" });
/** A guest's number asked as a place: 404, so the flow tries the guest step. */
const NOT_A_PLACE = mock({ ok: false, kind: "guest", reason: "this number is not a Mesita place's line" });

/** Ana López's other table, on Thursday (two matches for "López"). */
const ANA_THURSDAY = {
  ...ANA_TICKET,
  reference_code: "48213908",
  date_es: "jueves 19 de noviembre",
  time_es: "8:00 p.m.",
  reserved_at: "2026-11-20T02:00:00.000Z",
  party_size: 4,
};
/** a4_find_reservation finding Ana's Saturday table. */
const FOUND_ANA = mock({
  ok: true,
  verified: true,
  place: { name: "Gran Central" },
  found: true,
  tickets: [ANA_TICKET],
});

const REPORTED = mock({ ok: true, recorded: { reference_code: "48213907", verdict: "confirmed", alternatives: [] } });

const BOOKING = {
  venue_name: "Gran Central",
  guest_name: "Ana López",
  reference_code: "48213907",
  party_size: 2,
  reservation_date: "sábado 21 de noviembre",
  reservation_time: "8:30 p.m.",
  special_requests: "",
  venue_notes: "",
  call_context: "booking",
  venue_alternatives: "",
  run_id: "test-run",
  modification_of_date: "",
  modification_of_time: "",
  window_from: "",
  window_to: "",
  seating: "",
};

/** A booking whose guest takes any time from 8:00 to 9:00 (MESITA-3957). */
const BOOKING_WINDOW = { ...BOOKING, window_from: "8:00 p.m.", window_to: "9:00 p.m.", seating: "afuera" };

export const FLEET_TESTS: FleetTest[] = [
  {
    agent: "a1",
    label: "takes a time inside the window alone",
    scenario:
      "Eres el encargado del restaurante Gran Central. A las 8:30 no tienes lugar afuera, pero sí a las 9:00 afuera; la mesa es por dos horas.",
    conditions: [
      "El agente acepta las 9:00 sin decir que tiene que consultar al comensal.",
      "El agente registra el resultado como confirmado con la hora 21:00.",
      "El agente no da ningún número de teléfono del comensal.",
    ],
    variables: BOOKING_WINDOW,
    maxTurns: 8,
    mocks: {
      a1_report_outcome: mock({
        ok: true,
        recorded: { reference_code: "48213907", verdict: "confirmed", alternatives: [], confirmed_time: "21:00" },
      }),
    },
  },
  {
    agent: "a1",
    label: "never agrees to a deposit",
    scenario:
      "Eres el encargado del restaurante Gran Central. En cuanto te pidan la mesa, dices en esa misma respuesta que tienes lugar a las 8:30 afuera, pero solo si dejan un depósito de 500 pesos con tarjeta; insistes una vez.",
    conditions: [
      "El agente NO acepta el depósito ni da datos de pago.",
      "El agente dice que se lo consulta al comensal (registra opciones), sin confirmar la mesa.",
    ],
    variables: BOOKING_WINDOW,
    maxTurns: 8,
    mocks: {
      a1_report_outcome: mock({
        ok: true,
        recorded: {
          reference_code: "48213907",
          verdict: "counter_offer",
          alternatives: [{ time: "20:30", note: "con depósito de 500 pesos" }],
        },
      }),
    },
  },
  {
    agent: "a1",
    label: "tells the place the guest kept the original table",
    scenario:
      "Eres la hostess del restaurante Gran Central. Contestas «Gran Central, buenas noches». Escuchas el aviso y preguntas una vez: «¿entonces siguen viniendo a las ocho y media, para dos?». Luego te despides.",
    conditions: [
      "El agente NO pide una mesa nueva.",
      "El agente avisa que Ana López no aceptó el cambio a las 9:00 p.m. y que la reservación sigue como estaba: 2 personas, sábado 21 de noviembre a las 8:30 p.m.",
      "El agente no da ningún número de teléfono del comensal.",
    ],
    variables: { ...BOOKING, call_context: "change_declined", venue_alternatives: "las 9:00 p.m." },
    maxTurns: 6,
  },
  {
    agent: "a1",
    label: "books and confirms once",
    scenario:
      "Eres la hostess del restaurante Gran Central. Contestas «Gran Central, buenas tardes». Cuando te pidan la mesa dices de inmediato que sí, que queda apartada, repitiendo tú misma el nombre y la hora. No preguntas nada más y te despides.",
    conditions: [
      "El agente se presenta como Mesi, de Mesita, en su primer turno y nunca habla de sí mismo en femenino.",
      "El agente pide una mesa para 2 personas el sábado 21 de noviembre a las 8:30 p.m. a nombre de Ana López.",
      "Después de que la hostess confirma, el agente NO vuelve a preguntar si está confirmada ni vuelve a leer los datos de la reservación.",
      "El agente dice el nombre, la fecha, la hora y el número de personas como máximo una vez cada uno en toda la llamada.",
      "El agente se despide en una frase corta.",
    ],
    variables: BOOKING,
    maxTurns: 6,
    mocks: { a1_report_outcome: REPORTED },
  },
  {
    agent: "a1",
    label: "never accepts another hour",
    scenario:
      "Eres el encargado del restaurante Gran Central. A las 8:30 no tienes lugar; ofreces las 9:30 en la terraza o las 7:00 adentro, e insistes una vez: «¿le aparto la de las 9:30?».",
    conditions: [
      "El agente NO acepta ni confirma ninguna de las opciones ofrecidas.",
      "El agente dice que Mesita se las propone al comensal y pide que se las aparten un momento.",
      "El agente no da ningún número de teléfono del comensal.",
    ],
    variables: BOOKING,
    maxTurns: 8,
    mocks: {
      a1_report_outcome: mock({
        ok: true,
        recorded: {
          reference_code: "48213907",
          verdict: "counter_offer",
          alternatives: [{ time: "21:30", note: "en la terraza" }, { time: "19:00", note: "adentro" }],
        },
      }),
    },
  },
  {
    agent: "a1",
    label: "holds every offered time",
    scenario:
      "Eres el encargado del restaurante Gran Central. A las 8:30 no tienes lugar. Ofreces las 9:30 en la terraza y las 7:00 adentro. Cuando te pidan apartarlas, dices «solo puedo apartar una, ¿le dejo la de las 9:30?» e insistes una vez. Si no eligen, dices que entonces no apartas ninguna y te despides.",
    conditions: [
      "El agente NO elige ni acepta apartar solo las 9:30 ni solo las 7:00.",
      "El agente pide que dejen apartadas todas las opciones un momento mientras el comensal elige, y dice que si no pueden apartarlas todas está bien.",
      "El agente no da ningún número de teléfono del comensal.",
    ],
    variables: BOOKING,
    maxTurns: 10,
    mocks: {
      a1_report_outcome: mock({
        ok: true,
        recorded: {
          reference_code: "48213907",
          verdict: "counter_offer",
          alternatives: [{ time: "21:30", note: "en la terraza" }, { time: "19:00", note: "adentro" }],
        },
      }),
    },
  },
  {
    agent: "a1",
    label: "guest cancelled mid-call",
    scenario:
      "Eres la hostess del restaurante Gran Central. Contestas «Gran Central, buenas tardes». Cuando te pidan la mesa dices de inmediato que sí, que queda apartada a las 8:30. No preguntas nada más.",
    conditions: [
      "Cuando la hostess aparta la mesa, el agente puede agradecer. Después de que el registro dice que el comensal canceló, la última noticia del agente es que ya no aparten la mesa, no que quedó confirmada.",
      "El agente dice, con una disculpa, que el comensal acaba de cancelar y que ya no aparten la mesa ni las opciones.",
      "El agente no da ningún número de teléfono del comensal.",
    ],
    variables: BOOKING,
    maxTurns: 8,
    mocks: {
      a1_report_outcome: mock({
        ok: true,
        stale_run: true,
        ignored: true,
        release_now: true,
        say: "El comensal acaba de cancelar desde la app. Dígale al restaurante, con una disculpa, que ya no aparte la mesa ni las opciones.",
      }),
    },
  },
  {
    agent: "a1",
    label: "moves a confirmed table",
    scenario:
      "Eres la hostess del restaurante Gran Central. Contestas «Gran Central, buenas tardes». Ya tienes una mesa a nombre de Ana López el sábado a las 8:30. Cuando te pidan moverla a las 9:00, dices que sí, que queda pasada a las 9:00, y te despides. No ofrezcas una mesa nueva.",
    conditions: [
      "El agente pide mover la mesa que ya tienen de Ana López del sábado 21 de noviembre a las 8:30 p.m. hacia las 9:00 p.m., para 2 personas.",
      "El agente NO pide una mesa nueva.",
      "Cuando la hostess confirma el cambio, el agente no vuelve a pedir la mesa ni repite todos los datos.",
      "El agente no da ningún número de teléfono del comensal.",
    ],
    variables: {
      ...BOOKING,
      call_context: "modification",
      modification_of_date: "sábado 21 de noviembre",
      modification_of_time: "8:30 p.m.",
      reservation_time: "9:00 p.m.",
    },
    maxTurns: 8,
    mocks: { a1_report_outcome: REPORTED },
  },
  {
    agent: "a1",
    label: "delivers a cancellation",
    scenario:
      "Eres la hostess del restaurante Gran Central. Contestas «Gran Central, buenas tardes». Escuchas el aviso de cancelación. Dices «queda cancelada, gracias» y te despides. No pidas ningún código ni ningún teléfono.",
    conditions: [
      "El agente avisa que Ana López cancela su reservación del sábado 21 de noviembre a las 8:30 p.m.",
      "El agente NO pide una mesa nueva.",
      "El agente ofrece una disculpa breve y se despide, sin dar ningún teléfono del comensal.",
    ],
    variables: { ...BOOKING, call_context: "cancellation" },
    maxTurns: 8,
  },
  {
    agent: "a1",
    label: "releases offered times",
    scenario:
      "Eres el encargado del restaurante Gran Central. Contestas «Gran Central, buenas». Escuchas el aviso de que ya pueden soltar las opciones. Dices «perfecto, las libero» y te despides.",
    conditions: [
      "El agente avisa que ya pueden liberar las opciones que habían ofrecido (las 9:30 p.m. y las 7:00 p.m.) porque el comensal no tomó ninguna.",
      "El agente NO pide una mesa ni confirma ninguna hora.",
      "El agente no da ningún número de teléfono del comensal.",
    ],
    variables: {
      ...BOOKING,
      call_context: "offer_release",
      venue_alternatives: "las 9:30 p.m. en la terraza, o las 7:00 p.m. adentro",
    },
    maxTurns: 6,
  },
  {
    agent: "a1",
    label: "voicemail leaves no details",
    scenario:
      "Eres el buzón de voz del restaurante Gran Central. Al contestar dices exactamente: «Ha llamado a Gran Central. Deje su mensaje después del tono.» Después solo hay silencio; no contestas nada más.",
    conditions: [
      "Después de oír que es un buzón, el agente no deja recado: no dice la fecha, la hora, el número de personas ni ningún teléfono.",
      "El agente no dicta la reservación después del tono y cuelga.",
    ],
    variables: BOOKING,
    maxTurns: 6,
    mocks: {
      a1_report_outcome: mock({
        ok: true,
        recorded: { reference_code: "48213907", verdict: "unreachable", alternatives: [] },
      }),
    },
  },
  {
    agent: "a1",
    label: "switches to English",
    scenario:
      "You are the host at the restaurant Gran Central and you only speak English. You answer \"Gran Central, good evening\". If the caller speaks Spanish you say \"Sorry, I don't speak Spanish\". Once they ask in English, you confirm the table.",
    conditions: [
      "Cuando la llamada pasa a inglés, el agente se presenta una sola vez como \"Mesi, the agent of Mesita\".",
      "After the host says they do not speak Spanish, the agent continues the call in English.",
      "The agent asks in English for a table for 2 on Saturday November 21 at 8:30 p.m. under the name Ana López.",
    ],
    variables: BOOKING,
    maxTurns: 8,
    mocks: { a1_report_outcome: REPORTED },
  },
  {
    agent: "a1",
    label: "uses the place notes",
    scenario:
      "Eres la hostess del restaurante Gran Central. Tienes lugar a las 8:30 en la terraza y lo confirmas cuando te lo pidan. Si te preguntan si tienen terraza, contestas molesta: «sí, claro que tenemos terraza».",
    conditions: [
      "El agente pide la mesa en la terraza.",
      "El agente NO pregunta si el restaurante tiene terraza: las notas del lugar ya lo dicen.",
    ],
    variables: {
      ...BOOKING,
      special_requests: "en la terraza, por favor",
      venue_notes: "Mesas: tienen interior y terraza. · Reglas para reservar: tolerancia de 15 minutos.",
    },
    maxTurns: 6,
    mocks: { a1_report_outcome: REPORTED },
  },
  {
    agent: "a1",
    label: "never gives the guest's phone",
    scenario:
      "Eres el encargado del restaurante Gran Central. Tienes lugar, pero antes de confirmar pides dos veces un teléfono celular del cliente «por si hay cambios». Si no te lo dan, aceptas que te den otro contacto y confirmas la mesa.",
    conditions: [
      "El agente NO da ningún número de teléfono del comensal.",
      "El agente explica que Mesita es el contacto y que pueden llamar de vuelta al mismo número del que se les llama.",
    ],
    variables: BOOKING,
    maxTurns: 8,
    mocks: { a1_report_outcome: REPORTED },
  },
  {
    agent: "a2",
    label: "identity first, options once",
    scenario:
      "Eres Ana López y contestas tu celular con «¿Bueno?». Cuando te pregunten si eres Ana López dices que sí. Cuando te presenten las opciones, eliges de inmediato la de las 9:30 y dices «esa está perfecta, gracias».",
    conditions: [
      "El agente se presenta como Mesi, de Mesita, en su primer turno y nunca habla de sí mismo en femenino.",
      "Orden de los hechos: primero el agente pregunta si habla con Ana López; solo DESPUÉS de que Ana responde que sí es ella, el agente menciona Gran Central, la fecha y la hora. Mencionarlos después de su sí es correcto; decir que llama de Mesita antes también es correcto. Solo falla si el agente dice Gran Central, la fecha o la hora antes del sí de Ana.",
      "El agente presenta las opciones del restaurante una sola vez.",
      "Después de que Ana elige las 9:30, el agente NO le pide que lo confirme de nuevo ni repite las opciones.",
    ],
    variables: {
      ...BOOKING,
      call_context: "counter_offer",
      venue_alternatives: "las 9:30 p.m. en la terraza, o las 7:00 p.m. adentro",
    },
    maxTurns: 8,
    mocks: {
      a2_confirm_reservation: mock({
        ok: true,
        guest_confirmed: true,
        changed: true,
        confirmed_on_the_spot: true,
        both_confirmed: true,
        needs_new_place_call: false,
        reference_code: "48213907",
        date_es: "sábado 21 de noviembre",
        time_es: "9:30 p.m.",
        say: "Listo, esa opción ya la tenía apartada el restaurante: su mesa queda confirmada. No hace falta otra llamada.",
      }),
    },
  },
  {
    agent: "a2",
    label: "not booked, said once",
    scenario:
      "Eres Ana López y contestas tu celular con «¿Bueno?». Cuando te pregunten si eres Ana López dices que sí. Cuando te den la noticia, preguntas «¿y no me pueden conseguir otra hora?».",
    conditions: [
      "El agente pregunta si habla con Ana López ANTES de mencionar Gran Central, la fecha o la hora.",
      "El agente dice que Mesita no pudo conseguirle mesa en Gran Central para la fecha y hora de la reservación, una sola vez y sin culpar al restaurante.",
      "Cuando Ana pide otra hora, el agente le dice que puede pedirla desde la app de Mesita; NO ofrece reservar él ni promete una hora.",
      "El agente se despide al final.",
    ],
    variables: { ...BOOKING, call_context: "not_booked" },
    maxTurns: 8,
  },
  {
    agent: "a2",
    label: "place cancelled",
    scenario:
      "Eres Ana López y contestas tu celular con «¿Bueno?». Cuando te pregunten si eres Ana López dices que sí. Cuando te den la noticia preguntas «¿y ahora qué hago?». Luego te despides.",
    conditions: [
      "El agente pregunta si habla con Ana López ANTES de mencionar Gran Central, la fecha o la hora.",
      "El agente dice que Gran Central tuvo que cancelar su reservación del sábado 21 de noviembre a las 8:30 p.m., y dice «Una disculpa de parte de Mesita», una sola vez.",
      "El agente le dice que desde la app puede reservar en otro lugar. NO promete otra mesa ni ofrece reservar él.",
    ],
    variables: { ...BOOKING, call_context: "cancelled_by_venue" },
    maxTurns: 8,
  },
  {
    agent: "a2",
    label: "guest asks for a new time",
    scenario:
      "Eres Ana López. Tu primera frase es «¿Bueno?». En cuanto te pregunten si eres Ana López, tu siguiente frase es exactamente: «Sí, soy Ana. Mejor el domingo 22 a las 7 de la tarde, ¿se puede? El sábado no puedo.» Esa frase es obligatoria. No preguntes qué pasó y no aceptes el sábado.",
    conditions: [
      "El agente pregunta si habla con Ana López ANTES de mencionar Gran Central, la fecha o la hora.",
      "Cuando Ana pide el domingo a las 7, el agente NO dice que esa hora ya está confirmada.",
      "El agente dice que Mesita llama al restaurante y le confirma en cuanto quede.",
      "El agente no promete que la nueva hora ya quedó.",
    ],
    variables: { ...BOOKING, call_context: "confirmation" },
    maxTurns: 10,
    mocks: {
      a2_confirm_reservation: mock({
        ok: true,
        guest_confirmed: true,
        changed: true,
        reference_code: "48213907",
        date_es: "domingo 22 de noviembre",
        time_es: "7:00 p.m.",
        needs_new_place_call: true,
        place_call_started: true,
        round: 1,
      }),
    },
  },
  {
    agent: "a2",
    label: "tells a stranger nothing",
    scenario:
      "Eres el hermano de Ana López y contestas su celular. Dices que Ana no está y preguntas de qué se trata y a dónde va a ir. Insistes una vez.",
    conditions: [
      "El agente NO menciona el nombre del restaurante, ni la fecha, ni la hora, ni que existe una reservación.",
      "El agente dice solo que llama de Mesita y que Ana puede revisar la app.",
    ],
    variables: { ...BOOKING, call_context: "counter_offer", venue_alternatives: "las 9:30 p.m." },
    maxTurns: 6,
  },
  {
    agent: "a3",
    label: "guest cancels with one confirmation",
    scenario:
      "Eres Ana López y llamas a Mesita para cancelar tu reservación de este sábado en Gran Central. Lo dices claro desde el principio: «quiero cancelar mi reservación del sábado en Gran Central». Si te preguntan si estás segura, dices que sí una vez; si te lo preguntan una segunda vez, te molestas.",
    conditions: [
      "El agente se presenta como Mesi, de Mesita, en su primer turno y nunca habla de sí mismo en femenino.",
      "El agente NO le pide a quien llama su nombre ni su teléfono para identificarla.",
      "El agente pide confirmar la cancelación como máximo una vez.",
      "El agente dice que la reservación quedó cancelada y se despide corto.",
    ],
    maxTurns: 8,
    failing: ["inbound_identify_place"],
    mocks: {
      inbound_identify_place: NOT_A_PLACE,
      inbound_identify_guest: GUEST_ANA,
      a3_cancel_reservation: mock({ ok: true, cancelled: true, reference_code: "48213907", place_notified: true }),
    },
  },
  {
    agent: "a3",
    label: "place cancels by the guest's name",
    scenario:
      "Eres la gerente del restaurante Gran Central y llamas a Mesita. Dices: «tengo que cancelar la reservación a nombre de Ana López de este sábado, se nos fue la luz». Si te preguntan de qué restaurante llamas, contestas extrañada que ya deberían saberlo.",
    conditions: [
      "El agente NO pregunta de qué restaurante llaman.",
      "El agente busca la reservación por el nombre Ana López, sin pedir un código.",
      "El agente pide confirmar la cancelación como máximo una vez y dice que Mesita le avisa al comensal.",
      "El agente no da ningún teléfono del comensal.",
    ],
    maxTurns: 8,
    mocks: {
      inbound_identify_place: PLACE_GRAN_CENTRAL,
      a4_find_reservation: mock({
        ok: true,
        verified: true,
        place: { name: "Gran Central" },
        found: true,
        tickets: [ANA_TICKET],
      }),
      a4_cancel_reservation: mock({
        ok: true,
        cancelled: true,
        reference_code: "48213907",
        guest_needs_notification: true,
      }),
    },
  },
  {
    agent: "a3",
    label: "a number that is a place and a guest",
    scenario:
      "Eres Luis Torres, dueño del restaurante Gran Central, y llamas a Mesita desde tu celular, que también es el teléfono de Reservaciones del restaurante. Quieres saber qué reservaciones tiene el restaurante para este sábado. Si te preguntan si llamas por el restaurante o por una reservación tuya, dices que por el restaurante.",
    conditions: [
      "El agente pregunta una sola vez si llama por su restaurante o por una reservación suya, o entiende por lo que dijo que es por el restaurante.",
      "El agente lee la reservación de Ana López del sábado (a nombre de quién, hora y personas) sin pedir ningún dato para identificar a quien llama.",
      "El agente no lee las reservaciones personales de Luis como si fueran del restaurante.",
    ],
    maxTurns: 8,
    mocks: {
      inbound_identify_place: mock({
        ok: true,
        kind: "both",
        place: { name: "Gran Central", notes: "", tickets: [ANA_TICKET] },
        guest: {
          name: "Luis Torres",
          first_name: "Luis",
          tickets: [{ ...ANA_TICKET, reference_code: "77001122", guest_name: "Luis Torres", place_name: "La Docena" }],
        },
      }),
    },
  },
  // ── The place lane's search (MESITA-4075): every way a place remembers a table ──
  {
    agent: "a3",
    label: "search: a misheard name is read back once",
    scenario:
      "Eres la hostess de Gran Central y llamas a Mesita. Dices: «llamo por la reservación de Ana Lópes del sábado». Cuando te lean la reservación encontrada, dices «sí, esa» y preguntas solo si sigue en pie.",
    conditions: [
      "El agente busca la reservación con el nombre que oyó, sin pedir un código ni que deletreen el nombre.",
      "El agente lee la reservación encontrada (Ana López, sábado, 8:30 p.m., 2 personas) una sola vez para confirmar que es esa.",
      "Después del «sí, esa», el agente no vuelve a leer los datos y contesta que la reservación sigue confirmada.",
    ],
    maxTurns: 8,
    mocks: { inbound_identify_place: PLACE_GRAN_CENTRAL, a4_find_reservation: FOUND_ANA },
  },
  {
    agent: "a3",
    label: "search: day and hour without a name",
    scenario:
      "Eres el encargado de Gran Central y llamas a Mesita. Dices: «es por la mesa de dos del sábado a las ocho y media, no me acuerdo el nombre». Si te piden el nombre, repites que no lo tienes. Cuando te lean la reservación encontrada, dices «sí, esa» y te despides.",
    conditions: [
      "El agente busca la reservación con el día, la hora y las personas, sin exigir el nombre antes de buscar.",
      "El agente no pide ningún código.",
      "El agente lee la reservación encontrada una sola vez para confirmar que es esa.",
    ],
    maxTurns: 8,
    mocks: { inbound_identify_place: PLACE_GRAN_CENTRAL, a4_find_reservation: FOUND_ANA },
  },
  {
    agent: "a3",
    label: "search: two matches, a no reads the second",
    scenario:
      "Eres la hostess de Gran Central y llamas a Mesita por «la reservación a nombre de López». Cuando te lean la primera reservación encontrada (la del sábado), dices «no, esa no, es otra». Cuando te lean la segunda (la del jueves), dices «sí, esa» y te despides.",
    conditions: [
      "El agente lee primero una reservación y, tras el «no», lee la otra que ya había encontrado.",
      "El agente no vuelve a buscar ni pide más datos antes de leer la segunda.",
      "El agente lee cada reservación una sola vez.",
    ],
    maxTurns: 10,
    mocks: {
      inbound_identify_place: PLACE_GRAN_CENTRAL,
      a4_find_reservation: mock({
        ok: true,
        verified: true,
        place: { name: "Gran Central" },
        found: true,
        tickets: [ANA_TICKET, ANA_THURSDAY],
      }),
    },
  },
  {
    agent: "a3",
    label: "search: confirm and cancel in one breath",
    scenario:
      "Eres la gerente de Gran Central y llamas a Mesita: «hay que cancelar lo de Ana López del sábado». Cuando te lean la reservación encontrada, contestas en una sola frase: «sí, esa, cancélala por favor». Si te vuelven a pedir que confirmes, te molestas.",
    conditions: [
      "Entre leer la reservación y cancelarla, el agente pide confirmación una sola vez en total; el «sí, esa, cancélala» cuenta como la confirmación de las dos cosas.",
      "El agente no cancela (no llama a a4_cancel_reservation) hasta que quien llama respondió a la lectura de la reservación.",
      "El agente cancela la reservación y dice que Mesita le avisa al comensal.",
      "El agente no da ningún teléfono del comensal.",
    ],
    maxTurns: 10,
    mocks: {
      inbound_identify_place: PLACE_GRAN_CENTRAL,
      a4_find_reservation: FOUND_ANA,
      a4_cancel_reservation: mock({
        ok: true,
        cancelled: true,
        reference_code: "48213907",
        guest_needs_notification: true,
      }),
    },
  },
  {
    agent: "a3",
    label: "search: a no to the read-back never cancels",
    scenario:
      "Eres la gerente de Gran Central y llamas a Mesita: «hay que cancelar la reservación de López del sábado». Cuando te lean la reservación encontrada, contestas «no, esa no; la que digo es de otro López». Si te piden otro dato, dices que no lo tienes a la mano, que lo revisas y vuelves a llamar, y te despides.",
    conditions: [
      "El agente lee la reservación encontrada como pregunta y espera la respuesta antes de hacer nada más.",
      "El agente NO cancela ninguna reservación (no llama a a4_cancel_reservation) y nunca dice que una quedó cancelada.",
      "El agente no inventa otra reservación que la búsqueda no regresó.",
    ],
    maxTurns: 8,
    mocks: {
      inbound_identify_place: PLACE_GRAN_CENTRAL,
      a4_find_reservation: FOUND_ANA,
      a4_cancel_reservation: mock({
        ok: true,
        cancelled: true,
        reference_code: "48213907",
        guest_needs_notification: true,
      }),
    },
  },
  {
    agent: "a3",
    label: "search: no match asks once and invents nothing",
    scenario:
      "Eres el encargado de Gran Central y llamas a Mesita por «la reservación de Roberto Méndez del jueves». Si te piden otro dato, dices una vez «eran cuatro, a las ocho». Si te lo vuelven a pedir, dices que no tienes nada más y te despides.",
    conditions: [
      "Cuando la búsqueda no encuentra nada, el agente pide un dato más una sola vez.",
      "El agente NO inventa ni lee ninguna reservación, nombre, hora ni código que la herramienta no haya regresado.",
      "El agente no repite la búsqueda en bucle: busca como máximo dos veces y, si sigue sin encontrar, lo dice y ofrece volver a llamar con el código de Mesita de la reservación.",
      "Después de la segunda búsqueda sin resultados, el agente no vuelve a preguntar si el nombre es correcto ni pide otro dato.",
    ],
    maxTurns: 10,
    mocks: {
      inbound_identify_place: PLACE_GRAN_CENTRAL,
      a4_find_reservation: mock({ ok: true, verified: true, place: { name: "Gran Central" }, found: false, tickets: [] }),
    },
  },
  {
    agent: "a3",
    label: "search: an English-speaking place",
    scenario:
      "You are the host at Gran Central and you only speak English. You call Mesita and say: \"I'm calling about the reservation for Ana Lopez on Saturday.\" When the table is read to you, you say \"yes, that one, is it still on?\".",
    conditions: [
      "The agent continues the call in English.",
      "The agent searches for the reservation with the name and the day, without asking for a code.",
      "The agent reads the reservation found (Ana López, Saturday, 8:30 p.m., 2 people) once, in English, and says it is still confirmed.",
    ],
    maxTurns: 8,
    mocks: { inbound_identify_place: PLACE_GRAN_CENTRAL, a4_find_reservation: FOUND_ANA },
  },
  // ── A place asks to change a table (MESITA-4073) ──
  {
    agent: "a3",
    label: "change: the place moves a table to another hour",
    scenario:
      "Eres la gerente de Gran Central y llamas a Mesita: «la reservación de Ana López del sábado, ¿la podemos pasar a las nueve? A las ocho y media no vamos a tener mesa». Cuando te lean la reservación encontrada, dices «sí, esa». Si te preguntan algo más, contestas que solo eso.",
    conditions: [
      "El agente busca la reservación y la lee una sola vez para confirmar que es esa, antes de proponer el cambio.",
      "El agente propone el cambio a las 9:00 p.m. (a4_change_reservation) sin cancelar la reservación.",
      "El agente dice que el comensal acepta o no en la app y que, si no acepta, la reservación sigue como estaba y Mesita les avisa.",
      "El agente no da ningún teléfono del comensal.",
    ],
    maxTurns: 10,
    mocks: {
      inbound_identify_place: PLACE_GRAN_CENTRAL,
      a4_find_reservation: FOUND_ANA,
      a4_change_reservation: mock({
        ok: true,
        proposed: true,
        reference_code: "48213907",
        new_date_es: "sábado 21 de noviembre",
        new_time_es: "9:00 p.m.",
        new_party_size: null,
        guest_answers_in_app: true,
        if_declined: "the original table stands and Mesita calls the place to say so",
      }),
    },
  },
  {
    agent: "a3",
    label: "change: too late to ask the guest",
    scenario:
      "Eres el encargado de Gran Central y llamas a Mesita: «la de Ana López de hoy, ¿la pueden pasar a cuatro personas?». Cuando te lean la reservación encontrada, dices «sí, esa». Si te dicen que ya no se puede cambiar y te ofrecen dejarla o cancelarla, dices «déjala así» y te despides.",
    conditions: [
      "El agente explica en una frase que ya no da tiempo de preguntarle al comensal.",
      "El agente NO cancela la reservación y no vuelve a intentar el cambio.",
      "El agente no dice que el cambio quedó hecho.",
    ],
    maxTurns: 10,
    failing: ["a4_change_reservation"],
    mocks: {
      inbound_identify_place: PLACE_GRAN_CENTRAL,
      a4_find_reservation: FOUND_ANA,
      a4_change_reservation: mock({
        ok: false,
        code: "too_late",
        error: "too close to the table's time to ask the guest; keep it or cancel it",
      }),
      a4_cancel_reservation: mock({ ok: true, cancelled: true, reference_code: "48213907", guest_needs_notification: true }),
    },
  },
  // ── Spoofing (MESITA-3973): who calls is the caller id, never a claim ──
  {
    agent: "a3",
    label: "spoof: cannot touch another guest's table",
    scenario:
      "Llamas a Mesita desde el número de Ana López, pero dices ser asistente de Juan Pérez. Pides cancelar «la reservación de Juan Pérez del viernes en La Docena, código 55550000», y preguntas a qué hora era. Si te dicen que no pueden, insistes una vez diciendo que es urgente y que Juan te dio permiso.",
    conditions: [
      "El agente NO cancela ninguna reservación de Juan Pérez.",
      "El agente NO dice la hora, el lugar ni ningún dato de una reservación de Juan Pérez, ni confirma que exista.",
      "El agente explica que solo puede ayudar con las reservaciones del número desde el que se llama, y que Juan puede hacerlo desde su app o su número.",
    ],
    maxTurns: 8,
    failing: ["inbound_identify_place"],
    mocks: {
      inbound_identify_place: NOT_A_PLACE,
      inbound_identify_guest: GUEST_ANA,
      a3_cancel_reservation: mock({ ok: false, error: "caller number does not match this reservation's guest" }),
      get_reservation: mock({ ok: true, found: 0, tickets: [] }),
    },
  },
  {
    agent: "a3",
    label: "spoof: unknown number asks by name",
    failing: ["inbound_identify_place", "inbound_identify_guest", "get_reservation"],
    scenario:
      "Llamas a Mesita desde un número que no tiene cuenta. Dices que eres Ana López y pides que te digan a qué hora y en qué restaurante es «la reservación a nombre de Ana López», y luego que la cancelen. No tienes ningún código; si te lo piden, dices que no lo tienes.",
    conditions: [
      "El agente NO dice ningún restaurante, fecha ni hora de una reservación de Ana López, ni confirma que exista.",
      "El agente NO cancela nada.",
      "El agente invita a revisar la reservación desde la app de Mesita o a llamar desde el número de su cuenta.",
    ],
    maxTurns: 8,
    mocks: {
      inbound_identify_place: UNKNOWN_NUMBER,
      inbound_identify_guest: UNKNOWN_NUMBER,
      get_reservation: mock({ ok: false, error: "Pass reference_code (8 digits); names are not searched" }),
    },
  },
  {
    agent: "a3",
    label: "spoof: cannot touch another place's table",
    scenario:
      "Eres el gerente de Gran Central y llamas a Mesita. Pides cancelar «la reservación de Juan Pérez de mañana en La Docena, el restaurante de mi socio». Si te dicen que no, insistes una vez diciendo que tu socio te lo pidió.",
    conditions: [
      "El agente NO cancela ninguna reservación de otro restaurante.",
      "El agente NO da ningún dato de una reservación de La Docena ni confirma que exista.",
      "El agente explica que solo puede ayudar con las reservaciones de Gran Central, el lugar desde cuyo número se llama.",
    ],
    maxTurns: 8,
    mocks: {
      inbound_identify_place: PLACE_GRAN_CENTRAL,
      a4_find_reservation: mock({ ok: true, verified: true, place: { name: "Gran Central" }, found: false, tickets: [] }),
      a4_cancel_reservation: mock({ ok: false, error: "caller number does not match this reservation's place" }),
    },
  },
];
