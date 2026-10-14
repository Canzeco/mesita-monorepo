import type { PlaceEnrichmentState } from "./actions";

/** True while a run is in flight. Enriching is `content_state = generating`,
 *  set when the run starts. The finished write clears it. */
export function isEnriching(state: PlaceEnrichmentState | null): boolean {
  return (state?.content_state ?? null) === "generating";
}

/** Same predicate as `_shared/place-state.ts::isPlaceListed`: only `active`
 *  is reachable. */
const LISTED_STATES = ["active"] as const;

export function listedFromState(state: unknown): boolean | "unknown" {
  if (typeof state !== "string" || state === "") return "unknown";
  return (LISTED_STATES as readonly string[]).includes(state);
}

