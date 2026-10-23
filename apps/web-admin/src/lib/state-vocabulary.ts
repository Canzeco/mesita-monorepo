// State — two boxes (Pato, 2026-08-25 · Profile States + Enrichment Steps, 2026-10-13).
//
//   PROFILE STATES (7)  One box (Pato, 2026-10-13, MESITA-2176):
//                 Created · Pulsing (Google active) · Requested ·
//                 Enriching · Enriched · Selected · Disabled.
//                 Selected (MESITA-2707, MESITA-2730) is Mesita Selected —
//                 the operator's own mark, `places.selected`. Independent of
//                 Enriched: a Created place can be Selected, and an Enriched
//                 place need not be. Stored, never derived from the rail.
//                 All are bools (`true` / `false`) except Requested, the
//                 guest request count, 0…n — not a Yes/No. Disabled is the
//                 operator's off switch (places.state is not active), the
//                 old Listed turned over: `true` is the warning.
//
//                 The MVP First Stage cut the commercial facts: Verified
//                 (MESITA-2106), then Owned · Partnered · Rewards · Mesita
//                 Pay · Mesita Credits (MESITA-2115). Nobody holds, proves,
//                 pays or redeems yet.
//   ENRICHMENT STEPS (8)  their own box: 1. Details Enriched …
//                 8. Vectors Enriched, each a bool (called or not).
//                 Seed is Create-only and is not a step on this box.
//                 Details, Description and Vectors also run on Create;
//                 the "Enriched" suffix is the Enrich pass of that function.
//                 The stored key of function 8 stays `embedding`.
//
// Repeating the row name on the chip is redundant. Enriching is the live run;
// Enriched is last-completed — they are independent. Since MESITA-2027 there
// is ONE ladder: Create runs 0, 1, 7, 8; Strong Enrich runs 1–8 and Weak
// Enrich 1 and 4–8, one Render task per place, and its write stamps each
// step (MESITA-2420). Enrichment Steps prints the Enrich pass only (1–8),
// each named "X Enriched". Seed stays step 0 in the ladder and off that box.
// Wire key `seeded` stays; the row existing IS the seed.
//
// A NOTE ON THE WORD `STEP`. These are the LADDER's steps — what an operator
// is told ran. The pipeline's own stages (S1…S8 inside the three Enricher
// EFs) are a different sequence and deliberately do not line up: Reviews is
// step 5 but its Apify scrape FIRES at S2 and is collected after S4, because
// it depends only on the place id and overlaps the rest. Stages are a
// schedule; steps are a report. Nothing matches on the S-number.
//
// Step 8 was renamed `semantic` → `embedding` (§8.4); stored blobs and event
// payloads may still say `semantic` — readers fold, never rewrite. `pulse`
// (a subprocess of Details since MESITA-2027) and `menu` (operator input the
// Enricher never derived) were steps until then and are ignored on read,
// never folded.

export type StateBoolChip = "true" | "false" | "?" | "…";

/** Chip for a binary State fact. Loading and unknown stay distinct. */
export function stateBoolChip(
  value: boolean | "unknown" | "loading" | null | undefined,
): StateBoolChip {
  if (value === "loading") return "…";
  if (value === "unknown" || value == null) return "?";
  return value ? "true" : "false";
}

/** Guest request count. Missing is "?"; the State fact is the number. */
export function requestCountFromRow(
  requestCount: unknown,
): number | "unknown" {
  if (requestCount == null || requestCount === "") return "unknown";
  const n = Number(requestCount);
  if (!Number.isFinite(n) || n < 0) return "unknown";
  return Math.trunc(n);
}

/** Chip for Requested: `0` · `1` · `12` · … or `?`. Never true/false. */
export function requestCountChip(requestCount: unknown): string {
  const n = requestCountFromRow(requestCount);
  return n === "unknown" ? "?" : String(n);
}

/** The seven profile states, in the order the Profile States box prints them.
 *  Verified · Owned · Partnered · Rewards · Mesita Pay · Mesita Credits left
 *  with the MVP First Stage cut (MESITA-2106, MESITA-2115): nobody holds,
 *  proves, pays or redeems yet. Wire key `seeded` stays; the label is Created. */
export const GENERAL_STATE_FACTS = [
  { key: "seeded", label: "Created" },
  { key: "pulsing", label: "Pulsing" },
  { key: "requested", label: "Requested" },
  { key: "enriching", label: "Enriching" },
  { key: "enriched", label: "Enriched" },
  { key: "selected", label: "Selected" },
  { key: "disabled", label: "Disabled" },
] as const;

export type GeneralStateKey = (typeof GENERAL_STATE_FACTS)[number]["key"];

/** Reviews states: whether each source resolved. Yes or no. Stars, snippets
 *  and follower counts are display, never a state. Google stays in the list
 *  so the three sources stay symmetric. */
export const REVIEW_STATE_FACTS = [
  { key: "google_found", label: "Google Found" },
  { key: "instagram_found", label: "Instagram Found" },
  { key: "facebook_found", label: "Facebook Found" },
] as const;

export type ReviewStateKey = (typeof REVIEW_STATE_FACTS)[number]["key"];

/** Facts where `true` is the problem: a Disabled place is switched off. The
 *  tables draw them rose when true and green when false. */
export const BAD_WHEN_TRUE: ReadonlySet<GeneralStateKey> = new Set(["disabled"]);

/** EMPTY (Pato, 2026-09-08, decision: overturns MESITA-1608's "a free place
 *  and a place that doesn't take a not-yet-live rail are not defects"):
 *  "small ui details make them same color style, like red-green not gray"
 *  — Partner/Mesita Pay/Credits/Owned used to render grey when false; every
 *  general-state false reads rose now, no exceptions. Kept as a live map,
 *  not deleted, because the shape (StateCell's `falseTone` prop, the
 *  `?? "pending"` fallback at both call sites) is unchanged — only which
 *  keys populate it did. */
export const STATE_FACT_FALSE_TONE: Partial<Record<GeneralStateKey, "neutral">> = {};

export type CrenupFlow = "create" | "enrich";

export const CRENUP_STEPS = [
  { key: "seed", label: "Seed", n: 0, flows: ["create"] },
  { key: "details", label: "Details", n: 1, flows: ["create", "enrich"] },
  { key: "serp", label: "Serp", n: 2, flows: ["enrich"] },
  { key: "links", label: "Links", n: 3, flows: ["enrich"] },
  { key: "social", label: "Social", n: 4, flows: ["enrich"] },
  { key: "reviews", label: "Reviews", n: 5, flows: ["enrich"] },
  { key: "images", label: "Images", n: 6, flows: ["enrich"] },
  { key: "description", label: "Description", n: 7, flows: ["create", "enrich"] },
  { key: "embedding", label: "Vectors", n: 8, flows: ["create", "enrich"] },
] as const;

export type CrenupStepKey = (typeof CRENUP_STEPS)[number]["key"];

/** Operator label: `0. Seed` … `8. Vectors`. The key stays `embedding`. */
export function crenupStepLabel(n: number, label: string): string {
  return `${n}. ${label}`;
}

/** Enrichment Steps on a place: `1. Details Enriched` … `8. Vectors Enriched`. */
export function enrichmentStepLabel(n: number, label: string): string {
  return `${n}. ${label} Enriched`;
}

/** True when Enrich runs this function. Seed is the only step this rejects. */
export function stepEnriches(flows: readonly string[]): boolean {
  return flows.includes("enrich");
}

/** Which run shape a function belongs to. Shared functions are both. */
export function crenupFlowTag(flows: readonly string[]): string {
  const create = flows.includes("create");
  const enrich = flows.includes("enrich");
  if (create && enrich) return "Create + Enrich";
  if (create) return "Create";
  return "Enrich";
}

/**
 * Tag for a function Create also runs. Enrich-only returns null so the
 * Enrichment box does not repeat itself on every row.
 */
export function creationFlowMark(flows: readonly string[]): string | null {
  return flows.includes("create") ? crenupFlowTag(flows) : null;
}
