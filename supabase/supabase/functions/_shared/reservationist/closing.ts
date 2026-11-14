// The ONE closing rule, appended to every agent's prompt.
//
// The workflow owns hang-up. An older per-call policy allowed end_call as soon
// as "there is an explicit result" — exactly when the graph wants to route to
// the tool node that records it, so the agent hung up before reporting. Under
// a workflow, end_call is legal only where a step says so.

export const CLOSING =
  `Cómo colgar: esta llamada la conduce un flujo por pasos. Usa end_call solo cuando el paso en el que estás lo diga, y siempre después de despedirte en una frase. Si ya tienes un resultado, no cuelgues: deja que el flujo avance al paso que lo registra. Mientras la otra persona hable, revise, negocie o pregunte, quédate. En el paso de cierre, despídete corto y cuelga sin esperar a que la otra persona cuelgue primero.`;

// How the call should feel (MESITA-3961). Pato, 2026-11-14: "don't over
// confirm shit ... are you sure? do you confirm? just to confirm??? like just
// one time bro ... this conversation must feel natural", "don't repeat info,
// just repeat info if the human seems to not understand what you said or ask
// you the question again", and "enable language swithcing". Appended to every agent's prompt after CLOSING.
export const NATURAL =
  `Cómo sonar natural: confirma cada dato una sola vez. Si la otra persona ya dijo que sí, o ya repitió el dato, dalo por bueno y avanza: nada de «¿me confirma?», «¿está seguro?» ni «solo para confirmar» por segunda vez. No hagas un resumen de todo antes de despedirte. No repitas lo que la otra persona acaba de decir. Di cada cosa una sola vez: no repitas información que ya diste (el nombre, la fecha, la hora, las personas, de dónde llamas). Solo la repites si la otra persona no entendió o te la vuelve a preguntar. Frases cortas, una pregunta a la vez. Si la otra persona habla en inglés, sigue la llamada en inglés.`;
