import type { PlaceHit } from "./actions";
import type { CRENUP_STEPS, GENERAL_STATE_FACTS } from "@/lib/state-vocabulary";

// One table row. A paste run keys by the pasted Google Place ID and may have
// no hit ("Not on Mesita"); an All places run keys by the Mesita id and always
// has one — a place with no google_place_id still belongs in the catalog.
export type Row = { key: string; googleId: string | null; hit: PlaceHit | null };

// A fact this payload cannot answer is "unknown", NEVER false.
//
// The trailing branch used to `return false`, which meant a fact added to
// GENERAL_STATE_FACTS compiled, rendered "no" on every row, and said so with
// total confidence — a silent wrong answer with nothing to catch it. Owned
// (MESITA-1608) is exactly that case here: admin-web-search-places reads the
// `profiles` view, which carries no claim column, so this table genuinely
// does not know. It says so.
export function factOn(
  hit: PlaceHit,
  key: (typeof GENERAL_STATE_FACTS)[number]["key"],
): boolean | "unknown" {
  if (key === "seeded") return hit.seeded;
  if (key === "pulsing") {
    // Google's silence is a third state. Flattening null to false asserts the
    // business is closed, which is a claim we never read (MESITA-1239).
    if (hit.business_state == null || hit.business_state === "") return "unknown";
    return hit.business_state === "OPERATIONAL";
  }
  // Disabled is the operator's off switch: places.state is not active.
  if (key === "disabled") return !hit.listed;
  if (key === "requested") return hit.request_count > 0;
  // An Enrich run completed — `enriched_at` set (MESITA-2154). NOT the
  // high-water reaching 8: that is the completeness meter, and a Created
  // place must never read Enriched off either it or content_state.
  if (key === "enriched") return hit.enriched;
  if (key === "enriching") return hit.enriching;
  // Mesita Selected (MESITA-2318): the Map/Feed gate — Enriched AND ready
  // (map-engine's requireReady) — and switched on, since a Disabled place
  // reaches no guest.
  if (key === "selected") {
    return hit.enriched && hit.content_state === "ready" && hit.listed;
  }
  return "unknown";
}

// CRENUP is a high-water: it stops counting at the first gap by design (its
// own comment in _shared/crenup-ladder.ts says so), so a place where `links`
// failed but `social`/`menu` later completed reads high-water 3 even though
// 5 and 7 landed. `enrich_functions` (MESITA-1611) is the honest per-function
// map — read it when the payload carries it, and only fall back to the
// high-water comparison for a payload that predates the field. Seed is never
// in that map (it is not a stamped Enrich function — the row existing IS the
// seed), so it always reads off `seeded` directly.
export function crenupCalled(
  hit: PlaceHit,
  fn: (typeof CRENUP_STEPS)[number],
): boolean {
  if (fn.key === "seed") return hit.seeded;
  if (hit.enrich_functions) {
    const state = hit.enrich_functions[fn.key]?.state;
    return state === "completed" || state === "failed";
  }
  return hit.enrich_crenup >= fn.n;
}
