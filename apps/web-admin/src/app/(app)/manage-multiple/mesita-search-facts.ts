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
  if (key === "active") {
    // Google's silence is a third state. Flattening null to false asserts the
    // business is closed, which is a claim we never read (MESITA-1239).
    if (hit.business_state == null || hit.business_state === "") return "unknown";
    return hit.business_state === "OPERATIONAL";
  }
  if (key === "listed") return hit.listed;
  if (key === "requested") return hit.request_count > 0;
  if (key === "enriched") {
    return hit.enrich_crenup_total > 0 && hit.enrich_crenup === hit.enrich_crenup_total;
  }
  if (key === "enriching") return hit.enriching;
  if (key === "verified") return hit.verified;
  if (key === "partner") return hit.partner;
  if (key === "promoting") return hit.promoting;
  if (key === "mesita_pay") return hit.mesita_pay;
  if (key === "credits") return hit.credits;
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
