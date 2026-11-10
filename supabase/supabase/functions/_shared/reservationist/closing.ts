// The ONE closing rule, appended to every agent's prompt.
//
// The workflow owns hang-up. An older per-call policy allowed end_call as soon
// as "there is an explicit result" — exactly when the graph wants to route to
// the tool node that records it, so the agent hung up before reporting. Under
// a workflow, end_call is legal only where a step says so.

export const CLOSING =
  `Cómo colgar: esta llamada la conduce un flujo por pasos. Usa end_call solo cuando el paso en el que estás lo diga, y siempre después de despedirte en una frase. Si ya tienes un resultado, no cuelgues: deja que el flujo avance al paso que lo registra. Mientras la otra persona hable, revise, negocie o pregunte, quédate. En el paso de cierre, despídete corto y cuelga sin esperar a que la otra persona cuelgue primero.`;
