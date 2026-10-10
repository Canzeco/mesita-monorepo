import type { PlaceEnrichmentState } from "./actions";

/** True while the Enricher pipeline is mid-flight.
 *  decision: Pato (MESITA-453) — Enriching = the WHOLE pipeline:
 *  research OR analysis OR contents. Never clear after research alone. */
export function isEnriching(state: PlaceEnrichmentState | null): boolean {
  const stage = state?.stage ?? null;
  if (stage === "research" || stage === "analysis" || stage === "contents") {
    return true;
  }
  const contentState = state?.content_state ?? null;
  return contentState === "generating" || contentState === "queued";
}

/** Same predicate as `_shared/place-state.ts::isPlaceListed` and the
 *  consumer RLS policy: only `active` and `lead` are reachable. */
export const LISTED_STATES = ["active", "lead"] as const;

export function listedFromState(state: unknown): boolean | "unknown" {
  if (typeof state !== "string" || state === "") return "unknown";
  return (LISTED_STATES as readonly string[]).includes(state);
}

/** Stamp `listed` from `state` so a merged write payload cannot keep a
 *  stale overview flag (Unlist wrote `paused` but left `listed: true`). */
export function withListedFromState<T extends { state?: unknown; listed?: boolean }>(
  place: T,
): T {
  const listed = listedFromState(place.state);
  if (listed === "unknown") return place;
  return { ...place, listed };
}

