// CRENUP — the enrichment ladder, as TWO FLOWS over ONE SEQUENCE
// (Main §8.4 v4, MESITA-2027). One sequence, not two:
//
//   0 seed → 1 details → 2 serp → 3 links → 4 social
//     → 5 reviews → 6 images → 7 description → 8 embedding
//
//   CREATE runs 0, 1, 7, 8 — awaited inline, the front door.
//   ENRICH runs 1–8 — sequential ticks, none awaits a nested run.
//
// ONE LADDER IS THE POINT. Create used to number itself 1–5 while Enrich
// numbered itself 1–10, so `details` was function 3 to one caller and function
// 2 to the other — two answers to "which function is this". The numbers are
// the ladder's now, not the caller's, and a caller simply runs a subset.
//
// SEED IS 0 AND IS NEVER STAMPED. The row existing IS the seed, so 0 is the
// persistence floor: a place reads 0 because it was seeded, not because it is
// in some pre-ladder state. Stamping it would pin the whole catalog at 0 the
// day a seed event failed to write. `S0` is legal under the step CHECK
// (`^S([0-9]{1,2}|X)$`) and always was — see the widening migration.
//
// PULSE IS NOT A STEP (MESITA-2027). Liveness is a SUBPROCESS OF
// DETAILS, not a rung. Functions 1 and 2 never bought separate data — they
// shared one `fetchGoogleBasics` call — so the old split bought a rung and no
// information. Details now reads `businessStatus` off its own fetch, writes
// `business_state`, and aborts before the cost ledger when the listing is
// dead. Nothing is lost: the fact stays queryable as a COLUMN (which the
// high-water never was), and Details' failure REASON distinguishes
// "permanently closed" from "spine incomplete". MESITA-2028 renamed the
// meter's machinery to Crenup, so `pulse` now names only that liveness
// subprocess — and, in the event log, a RETIRED key (CRENUP_RETIRED).
//
// MENU IS GONE (MESITA-2027). It had been a stub since the website content
// crawl was retired — it always passed with "no menu source yet", which is a
// rung reporting nothing. The menu is OPERATOR INPUT (`menu_pdf_url`,
// `menus`, the console's MenusSection), so the Enricher no longer claims to
// derive it. The menu DATA is untouched; only the claim went away.
//
// REVIEWS SITS BESIDE SOCIAL (4, 5). Both are Apify gathers of third-party
// content and they already run concurrently — the GMaps scrape depends only
// on the place id, so it is fired early and collected late. Grouping them in
// the ladder costs no wall clock and makes 1–6 read as one phase: the
// sources, in the order they can be asked.
//
// THE ORDER IS LOAD-BEARING, and four of the links are real data flows:
//   2 → 3  serp feeds the Resolver. It cannot pick between five Instagram
//          candidates on a name and a city; the editorial read is what says
//          which one is really this place.
//   3 → 4  you cannot scrape the Instagram until you know which Instagram.
//   4 → 6  the IG/FB gathers ARE the pools the vision funnel ranks.
//   7 → 8  embedding vectorises the text description just wrote.
// Reordering those does not cost latency, it costs CORRECTNESS: the Resolver
// picks the wrong account and every function after it enriches a different
// business. 5 is the only rung with slack, and it is spent.
//
// EACH FUNCTION PERSISTS ITS OWN OUTPUT (MESITA-2027). There is no `publish`
// stage and no `store` stage — those were steps that bought no function and
// reported on writes that happened two stages away. Rule 2 of crenup-report
// says `completed` means THE EFFECT LANDED, and that is far easier to honour
// now that the function which WRITES is the function which REPORTS.
// `content_state` still flips exactly ONCE, after 8, so a place never goes
// public wearing this run's images over last run's description.
//
// THE THREE TEXTS, each with exactly one reader, never collapsed:
//   SERP Summary        function 2 — soft context the PIPELINE reads
//   Presentation        function 7 — places.description, what a GUEST reads
//   Semantic Summary    function 8 — embedding_source_text, what the INDEX reads
//
// RENUMBERING IS SURVIVABLE BECAUSE NOTHING MATCHES ON THE NUMBER. The reader
// keys on `step_name` (the function KEY); the `S<n>` written beside it is
// decorative. Rows from every previous ladder still count correctly, and
// retired keys fall out of the walk: `pulse` and `menu` join `semantics`,
// `name` and `seed` as keys that were rungs once and are ignored now. No
// migration — shrinking the ladder cannot narrow a CHECK that already
// accepted S0–S99.
//
// `enriched` is NOT a count of functions that worked. It is HOW FAR THE QUEUE
// GOT: the index of the last good function, 0-8, where 0 is the SEEDED floor
// and 8 is a complete profile including both vectors. The queue is strictly
// linear, so ">= N" is a MEANINGFUL question to ask of it. It is not, today, a
// question anything can ask in SQL: this value is a read-time fold over the
// run-event log, not a column, so it cannot appear in a WHERE clause. Consumer
// visibility therefore gates on `content_state = 'ready'` instead
// (MESITA-1228) — a real predicate, applied before the pool cap.
//
// A CREATE THAT SKIPS ENRICH JUMPS TO 8 WITH 2–6 A GAP. That is the same
// accumulate-don't-reset rule as always, merely more visible now one ladder
// serves both flows: 8 means "the highest function that ran", not "fully
// enriched". A function a run did not buy writes NOTHING (MESITA-1172
// blocker 2) — that rule is what lets two callers share one ladder.
//
// THIS IS NOT THE TRIGGER MATRIX'S VOCABULARY. `enrich-triggers.ts` keys what a
// run may BUY (purchase units); these are what an operator is told. Different
// questions; the name overlap is a coincidence of subject.
//
// AND ABSENCE IS A RESULT, NOT A FAILURE. A place with no Instagram must still
// reach 8. The function ran, resolved "there is nothing here", and is
// `completed`.

export const CRENUP_LADDER = [
  "details",
  "serp",
  "links",
  "social",
  "reviews",
  "images",
  "description",
  "embedding",
] as const;

/**
 * Retired extra keys. Empty: Embedding is function 8, not an unnumbered
 * extra. Kept as an array so FUNCTION_STATE_KEYS can still spread it.
 */
export const CRENUP_EXTRAS = [] as const;

/** Pre-merge event / map keys. Folded into `embedding` on read (display). */
export const CRENUP_EXTRA_ALIASES = ["summary", "name"] as const;

/**
 * RETIRED function keys: rungs that existed on a previous ladder and are not
 * functions any more. They are NOT renames — nothing inherits their meaning —
 * so they must fall out of the walk rather than fold into a survivor.
 *
 *   pulse    the liveness gate, a rung until MESITA-2027. It is a subprocess
 *            of `details` now. Folding it into `details` would be WRONG: an
 *            old `pulse` completed proves the listing was alive, not that the
 *            Google spine persisted, and counting it would advance the queue
 *            past a function that never ran.
 *   menu     a stub rung that always passed. Folding it anywhere would import
 *            a completion that never meant anything.
 *
 * Listed rather than merely absent so the next reader knows these keys are
 * live in the event log and ignored ON PURPOSE. `latestByStep` drops any key
 * CRENUP_LADDER does not contain, so this array is documentation the compiler
 * cannot contradict — keep it honest by hand.
 */
export const CRENUP_RETIRED = ["pulse", "menu", "semantics", "seed"] as const;

/**
 * RENAMED function keys: the same function under its old name. Unlike the
 * display-only extras above, a rename COUNTS everywhere — the ladder walk,
 * the stored map merge, the State fold — because the function did not change,
 * only its name did (§8.4 v3: Semantic → Embedding, 2026-08-29).
 * NOTE the vocabulary firewall: `embedding` is also a trigger-matrix
 * subprocess key — a coincidence of subject, not a shared enum; neither
 * list may import the other.
 */
export const CRENUP_RENAMES: Readonly<Record<string, CrenupStep>> = {
  semantic: "embedding",
};

export type CrenupStep = (typeof CRENUP_LADDER)[number];

/**
 * What level 0 is CALLED on the meter: Seed. It is function 0 of the ladder
 * and the only one never stamped — the row existing IS the seed, so 0 is the
 * persistence floor rather than a pre-ladder limbo.
 */
export const CRENUP_FLOOR_LABEL = "Seed";

/** The operator-facing name of each function. Names only — see below for why. */
const CRENUP_LABELS: Record<CrenupStep, string> = {
  details: "Details",
  serp: "Serp",
  links: "Links",
  social: "Social",
  reviews: "Reviews",
  images: "Images",
  description: "Description",
  embedding: "Embedding",
};

/**
 * THE INDEX IS DERIVED, never written down (MESITA-1222).
 *
 * It used to be nine hand-typed literals sitting beside the array that already
 * defines the order, with nothing tying the two together. `crenupHighWater`
 * iterates the ARRAY and returns the META index, so a reorder that updated only
 * one of them would yield a high-water that skips or repeats a number — and the
 * S-number written to `place_enrichment_events` would drift from the function's
 * real position. PR #1072 reordered the array and renumbered by hand and got it
 * right; nothing would have caught it if it hadn't.
 *
 * The index is `i + 1`: the ladder counts 1-8 and 0 is SEED, the floor,
 * which is never stamped and so is not a member of the array.
 */
export const CRENUP_STEP_META: Record<
  CrenupStep,
  { index: number; label: string }
> = Object.fromEntries(
  CRENUP_LADDER.map((key, i) => [key, { index: i + 1, label: CRENUP_LABELS[key] }]),
) as Record<CrenupStep, { index: number; label: string }>;

/**
 * The labels in queue order — what a client renders beside the number.
 *
 * Shipped on the admin payloads so no other package hand-copies this list.
 * web-admin carried its own positional array with no shared import, no test and
 * no CI gate; the catalog would simply have shown the wrong function name
 * beside every number if a reorder had missed it.
 *
 * INDEXED BY FUNCTION NUMBER: `labels[0]` is Seed (the floor, never
 * stamped) and `labels[8]` is Embedding, so a reader renders
 * `labels[level]` with no off-by-one.
 */
export const CRENUP_LABELS_IN_ORDER: readonly string[] = [
  CRENUP_FLOOR_LABEL,
  ...CRENUP_LADDER.map((k) => CRENUP_STEP_META[k].label),
];

/**
 * The complete-profile number, so nothing hardcodes 8. Eight stamped
 * functions, so it IS the array length; Seed (0) sits below the array.
 */
export const CRENUP_TOTAL = CRENUP_LADDER.length;

/** One event row, narrowed to what the high-water needs. */
export type CrenupEvent = {
  step_name?: string | null;
  state?: string | null;
  created_at?: string | null;
};

const INDEX = new Map<string, number>(
  CRENUP_LADDER.map((k) => [k, CRENUP_STEP_META[k].index]),
);

/** Latest event per known function key — the log is append-only. */
function latestByStep(
  events: readonly CrenupEvent[],
): Map<string, { state: string; at: string }> {
  const latest = new Map<string, { state: string; at: string }>();
  for (const e of events) {
    const raw = (e.step_name ?? "").trim();
    // Renamed keys COUNT (the function is the same; only the name moved):
    // a stored `semantic` event is function 8 under its old name.
    const key = CRENUP_RENAMES[raw] ?? raw;
    // Unknown keys are ignored on purpose: legacy stage beacons (`gather`,
    // `publish`), retired rungs (CRENUP_RETIRED — `pulse`, `menu`,
    // `semantics`, `seed`), and pre-merge `name`/`summary` extras (those fold
    // into `embedding` on the State map, not this walk — an old `name` rung
    // must not count as function 8).
    if (!INDEX.has(key)) continue;
    const at = e.created_at ?? "";
    const prev = latest.get(key);
    if (!prev || at >= prev.at) {
      latest.set(key, { state: (e.state ?? "").trim(), at });
    }
  }
  return latest;
}

/**
 * How far the queue got, 0-8.
 *
 * The index of the last function such that IT AND EVERY FUNCTION BEFORE IT
 * completed. A gap stops the count: if `links` (4) failed but `social` (5)
 * later succeeded, the answer is 3, because a profile built past a hole is a
 * profile built on incomplete data — which is the whole reason the queue is
 * linear.
 *
 * 0 is the base case, and it is the FLOOR rather than a failure: the place is
 * seeded and nothing after it has landed. `seed` is function 0 and is never
 * stamped, so the walk starts at function 1 — see the header for why stamping
 * it would pin the whole catalog at 0. Embedding is 8: a place that finished
 * description without vectors reads 7.
 *
 * Events are an APPEND-ONLY log, so only the LATEST event per function counts.
 * A re-enrich that fixes function 4 raises the number; one that breaks it
 * lowers it.
 */
export function crenupHighWater(events: readonly CrenupEvent[]): number {
  const latest = latestByStep(events);

  let high = 0;
  for (const piece of CRENUP_LADDER) {
    const rec = latest.get(piece);
    // Only `completed` advances the queue. A missing function is one that has
    // never run — not a pass.
    if (!rec || rec.state !== "completed") break;
    high = CRENUP_STEP_META[piece].index;
  }
  return high;
}

/**
 * WHY the queue stopped where it did, or null when it finished.
 *
 * The high-water alone is ambiguous at every level, and the liveness gate
 * makes that ambiguity load-bearing at 0: function 1 (Details) FAILS a place
 * Google reports permanently closed, so 0 means both "seeded, nothing tried"
 * and "we asked, and the listing is dead". Two facts, one number — the exact
 * thing this ladder exists to prevent. Since MESITA-2027 that gate is a
 * SUBPROCESS of Details rather than its own rung, which is why the reason
 * below matters more, not less: the block reads `details` either way, and
 * only its message says which of the two happened.
 *
 * So the number ships with its reason. `failed` = the function ran and could
 * not do its job. `missing` = it has no event at all, which for a fresh place
 * is simply "not yet" and for a stalled one is "the run never got here".
 *
 * Derived from the same events the high-water walks, so the two can never
 * disagree — do not let a caller compute this from the number alone.
 */
export type CrenupBlock = {
  key: CrenupStep;
  index: number;
  state: "failed" | "missing";
};

export function crenupBlockedAt(
  events: readonly CrenupEvent[],
): CrenupBlock | null {
  const latest = latestByStep(events);
  for (const piece of CRENUP_LADDER) {
    const rec = latest.get(piece);
    if (rec?.state === "completed") continue;
    return {
      key: piece,
      index: CRENUP_STEP_META[piece].index,
      // Anything that is not `completed` and not absent — `failed`, or the
      // `skipped` a legacy row might carry — is the function having run and
      // not delivered. Only a total absence of events is "not yet".
      state: rec ? "failed" : "missing",
    };
  }
  return null;
}

/**
 * Every enrich function that has completed, in order — for a per-function
 * readout. Unlike the high-water it does NOT stop at a gap — it answers
 * "which ones landed", not "how far did the queue get". Being created is not
 * in the list: a place this is called about exists by definition.
 */
export function completedCrenupSteps(
  events: readonly CrenupEvent[],
): CrenupStep[] {
  const latest = latestByStep(events);
  return CRENUP_LADDER.filter((p) => latest.get(p)?.state === "completed");
}

/**
 * The high-water mark straight off a `places.enrichment` jsonb value — the
 * materialized column (MESITA-1249), not a fold over the event log. THE
 * shared reader: business-web-list-places and admin-web-search-places (and,
 * for ranking, discovery-place.ts's Crenup-high-water fold, MESITA-1598)
 * all read the same column and must never each parse it slightly
 * differently. Anything malformed reads 0 — the Seed floor — rather than
 * throwing.
 */
export function crenupOf(enrichment: unknown): number {
  if (!enrichment || typeof enrichment !== "object") return 0;
  const raw = (enrichment as { highWater?: unknown }).highWater;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(Math.trunc(n), CRENUP_TOTAL);
}
