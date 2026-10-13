import type { PlaceEnrichmentState } from "./actions";

/** True while the Enricher pipeline is mid-flight.
 *  decision: Pato (MESITA-453) — Enriching = the WHOLE pipeline:
 *  first OR second OR third. */
export function isEnriching(state: PlaceEnrichmentState | null): boolean {
  const stage = state?.stage ?? null;
  if (stage === "first" || stage === "second" || stage === "third") {
    return true;
  }
  return (state?.content_state ?? null) === "generating";
}

/** Same predicate as `_shared/place-state.ts::isPlaceListed`: only `active`
 *  is reachable. */
const LISTED_STATES = ["active"] as const;

export function listedFromState(state: unknown): boolean | "unknown" {
  if (typeof state !== "string" || state === "") return "unknown";
  return (LISTED_STATES as readonly string[]).includes(state);
}

