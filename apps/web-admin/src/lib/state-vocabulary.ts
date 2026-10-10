// State — two boxes (Pato, 2026-08-25 · 2026-08-29).
//
//   STATES (6)    Created · Active · Listed · Enriching · Enriched are bools
//                 (`true` / `false`). Requested is the guest request count,
//                 0…n — not a Yes/No. Never a places.state.
//
//                 The MVP First Stage cut the commercial facts: Verified
//                 (MESITA-2106), then Owned · Partnered · Rewards · Mesita
//                 Pay · Mesita Credits (MESITA-2115). Nobody holds, proves,
//                 pays or redeems yet.
//   CRENUP (9)    own box: 0. Seed … 8. Embedding, each a bool: called or not
//
// Repeating the row name on the chip is redundant. Enriching is the live run;
// Enriched is last-completed — they are independent. Crenup just names the
// nine steps. Since MESITA-2027 there is ONE ladder: Create runs 0, 1, 7, 8
// and Enrich runs 1–8, so a shared step no longer carries two numbers
// depending on who called it. It is still not a third State ladder. Wire key
// `seeded` stays; the label is Seed — step 0, never stamped, because the row
// existing IS the seed.
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

export const GENERAL_STATE_FACTS = [
  { key: "seeded", label: "Created" },
  { key: "active", label: "Active" },
  { key: "listed", label: "Listed" },
  { key: "requested", label: "Requested" },
  { key: "enriching", label: "Enriching" },
  { key: "enriched", label: "Enriched" },
  // Owned · Partnered · Rewards · Mesita Pay · Mesita Credits left with the
  // MVP First Stage cut (MESITA-2115): nobody holds, pays or redeems yet.
] as const;

export type GeneralStateKey = (typeof GENERAL_STATE_FACTS)[number]["key"];

/** EMPTY (Pato, 2026-09-08, decision: overturns MESITA-1608's "a free place
 *  and a place that doesn't take a not-yet-live rail are not defects"):
 *  "small ui details make them same color style, like red-green not gray"
 *  — Partner/Mesita Pay/Credits/Owned used to render grey when false; every
 *  general-state false reads rose now, no exceptions. Kept as a live map,
 *  not deleted, because the shape (StateCell's `falseTone` prop, the
 *  `?? "pending"` fallback at both call sites) is unchanged — only which
 *  keys populate it did. */
export const STATE_FACT_FALSE_TONE: Partial<Record<GeneralStateKey, "neutral">> = {};

export const CRENUP_STEPS = [
  { key: "seed", label: "Seed", n: 0 },
  { key: "details", label: "Details", n: 1 },
  { key: "serp", label: "Serp", n: 2 },
  { key: "links", label: "Links", n: 3 },
  { key: "social", label: "Social", n: 4 },
  { key: "reviews", label: "Reviews", n: 5 },
  { key: "images", label: "Images", n: 6 },
  { key: "description", label: "Description", n: 7 },
  { key: "embedding", label: "Embedding", n: 8 },
] as const;

export type CrenupStepKey = (typeof CRENUP_STEPS)[number]["key"];

export const GENERAL_STATE_COUNT = GENERAL_STATE_FACTS.length;
export const CRENUP_STEP_COUNT = CRENUP_STEPS.length;

/** Operator label: `0. Seed` … `8. Embedding`. */
export function crenupStepLabel(n: number, label: string): string {
  return `${n}. ${label}`;
}
