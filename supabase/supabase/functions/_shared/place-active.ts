// Operator Active write — Status box fact `active` (business_status ===
// OPERATIONAL) plus the side effect Pato named: Active off unlists.
//
// Pulse / enrich still overwrite business_status from Google. That does not
// re-list. Google is a flag; the operator unlist is the gate.

import { isPlaceListed } from "./place-status.ts";

export type OperatorBusinessStatus = "OPERATIONAL" | "CLOSED_PERMANENTLY";

export type ActiveWritePatch = {
  business_status: OperatorBusinessStatus;
  status?: "paused";
};

/** Patch for admin-web-set-place-active. Active on writes OPERATIONAL only.
 *  Active off writes CLOSED_PERMANENTLY and, when the place is listed,
 *  paused. Already-unlisted stays unlisted. */
export function activeWritePatch(
  active: boolean,
  currentStatus: unknown,
): ActiveWritePatch {
  if (active) return { business_status: "OPERATIONAL" };
  const patch: ActiveWritePatch = { business_status: "CLOSED_PERMANENTLY" };
  if (isPlaceListed(currentStatus)) patch.status = "paused";
  return patch;
}
