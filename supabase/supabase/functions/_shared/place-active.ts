// Operator Active write — State box fact `active` (business_state ===
// OPERATIONAL) plus the side effect Pato named: Active off unlists.
//
// Pulse / enrich still overwrite business_state from Google. That does not
// re-list. Google is a flag; the operator unlist is the gate.

import { isPlaceListed } from "./place-state.ts";

export type OperatorBusinessState = "OPERATIONAL" | "CLOSED_PERMANENTLY";

export type ActiveWritePatch = {
  business_state: OperatorBusinessState;
  state?: "paused";
};

/** Patch for admin-web-set-place-active. Active on writes OPERATIONAL only.
 *  Active off writes CLOSED_PERMANENTLY and, when the place is listed,
 *  paused. Already-unlisted stays unlisted. */
export function activeWritePatch(
  active: boolean,
  currentState: unknown,
): ActiveWritePatch {
  if (active) return { business_state: "OPERATIONAL" };
  const patch: ActiveWritePatch = { business_state: "CLOSED_PERMANENTLY" };
  if (isPlaceListed(currentState)) patch.state = "paused";
  return patch;
}
