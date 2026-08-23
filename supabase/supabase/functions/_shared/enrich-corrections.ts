// Corrections — the OTHER half of enrichment feedback. SKELETON, NOT BUILT.
//
// A trigger re-derives facts from external sources. It cannot carry a fact the
// sources do not have. When the Reservationist calls a place and learns the
// hours are Tue–Sun rather than Mon–Sat, re-running S1 refetches the SAME wrong
// hours from Google: the agent's knowledge is better than every source the
// Enricher can reach, and a re-enrich would destroy it.
//
// So agent feedback is not a trigger. It is a PROPOSAL — a field, a value, who
// observed it, how sure they are, and what they saw — which either applies
// itself (high confidence, trusted source) or queues for a human in the
// Verification Queue. Applying one PINS the field, and S8 (persist) must skip a
// pinned field, or the next scheduled run silently reverts the correction and
// every call is wrong again. That loop is the whole reason this file exists.
//
// Nothing below is wired yet: there is no proposals table, no EF, no writer,
// and the console says so. These are the types the future engine will fill, so
// the shape is decided once, in the open, rather than improvised later.
//
// Deliberately NOT modelled here: anything that re-fetches. That is the trigger
// matrix in enrich-triggers.ts, and the two must not merge.

/** Who observed the fact. Confidence is read per-source, never globally. */
export type CorrectionSource =
  | "reservationist" // heard it on a call with the venue
  | "business" // the place's own team said so in the console
  | "consumer_report" // a guest reported it from a ticket
  | "ojo" // vision read it off a submitted proof
  | "admin"; // an operator typed it

/**
 * Fields an observation may correct. Deliberately small: identity (name,
 * google_place_id) and anything generated are NOT correctable — identity is the
 * spine, and generated prose is the Enricher's to rewrite.
 */
export type CorrectableField =
  | "hours"
  | "phone"
  | "reservation_target"
  | "website_url"
  | "address"
  | "closes_at";

export type FieldProposal = {
  placeId: string;
  field: CorrectableField;
  /** Serialized so one shape carries hours-json and plain strings alike. */
  value: unknown;
  source: CorrectionSource;
  /** 0–1. Below the source's threshold the proposal queues instead of applying. */
  confidence: number;
  /** What was actually observed — a call snippet, a ticket id, a screenshot ref. */
  evidence: string;
  observedAt: string;
};

/**
 * Auto-apply floor per source. A call with the venue outranks a guest report on
 * hours because the venue IS the authority on its own hours; Ojo reads pixels,
 * so it proposes and a human decides.
 */
export const CORRECTION_AUTO_APPLY_FLOOR: Record<CorrectionSource, number> = {
  business: 0.0,
  admin: 0.0,
  reservationist: 0.8,
  consumer_report: 0.95,
  ojo: 1.01, // above 1 = never auto-applies, always queues
};

/** How long an applied correction outranks the Enricher for that field. */
export const CORRECTION_PIN_DAYS = 90;

/** True when a proposal may write straight through. */
export function autoApplies(p: FieldProposal): boolean {
  return p.confidence >= CORRECTION_AUTO_APPLY_FLOOR[p.source];
}
