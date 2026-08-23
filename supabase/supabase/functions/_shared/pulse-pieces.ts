// PULSE — the enrichment machinery, as TWO FLOWS over SHARED FUNCTIONS
// (MESITA-1253, superseding the function-0 framing of MESITA-1243).
//
//   CREATE (ONE function, synchronous, the front door):
//     1 seed → 2 pulse → 3 details      · semantic: summary · name
//   ENRICH (NINE functions, the queue, strictly in order):
//     1 pulse → 2 details → 3 serp → 4 links → 5 social
//     → 6 images → 7 menu → 8 reviews → 9 description
//                                       · semantic: summary · name
//
// Pulse, Details, Summary and Name appear in BOTH flows because they are
// SHARED FUNCTIONS with two callers: CREATE runs them inline (a place is born
// with its liveness checked, its Google spine persisted, and its vector
// queued), ENRICH runs them as queue rungs (a place is refreshed). Seed is NOT
// an enrich function at all — it is step 1 of CREATE, and the row existing IS
// the seed. That is why this array starts at pulse and why `enriched = 0`
// means CREATED: the place exists and no enrich function has completed.
//
// CREATE IS A RUN LIKE ANY OTHER. It stamps the functions it actually ran
// (pulse, details — and summary when the vector write lands), so a healthy
// fresh place reads 2/9 the moment it exists, and state accumulates across
// create and every later run under one rule. A function a run did not buy
// writes NOTHING (MESITA-1172 blocker 2) — that rule is what lets two callers
// share one ladder.
//
// WHY NAME AND SUMMARY ARE SEMANTIC FUNCTIONS AND NOT RUNGS. The On-Update
// path fires the same machinery whenever an operator edits the profile, and
// `enriched` must not fall because someone renamed a place. Counting either
// would stop answering "how far did the queue get". `name` (the Mesita Name as
// its own vector) is DECLARED BUT NOT BUILT (MESITA-1238).
//
// RENUMBERING IS SURVIVABLE BECAUSE NOTHING MATCHES ON THE NUMBER. The reader
// keys on `step_name` (the function KEY); the `S<n>` written beside it is
// decorative. Dropping `seed` from this array moved NO number: pulse was
// already 1 and description already 9. Rows from every previous ladder still
// count correctly; retired keys (`name` as a rung, `semantics`, `seed` if any
// ever existed) fall out of the walk.
//
// THE ORDER IS LOAD-BEARING. `serp` runs BEFORE `links` because that is what
// serp is FOR: Agent Y cannot pick between five Instagram candidates on a name
// and a city, and the editorial read is what tells it which one is really this
// place. Function 9 grounding on the same text is a SECOND USE of something
// bought for the first — do not reorder the queue to serve it. `social` runs
// BEFORE `images` because the Instagram/Facebook gathers fill the pools the
// vision funnel ranks. `menu` sits after `links` (its source) and before
// `description` (which would read it). `description` CLOSES the queue at 9,
// and the semantic functions run after it, vectorising the text the queue just
// wrote.
//
// THE THREE TEXTS, each with exactly one reader, never collapsed:
//   SERP Summary        function 3 — soft context the PIPELINE reads
//   Presentation        function 9 — places.description, what a GUEST reads
//   Semantic Summary    semantic   — embedding_source_text, what the INDEX reads
//
// `enriched` is NOT a count of functions that worked. It is HOW FAR THE QUEUE
// GOT: the index of the last good function, 0-9, where 0 is the CREATED floor.
// The queue is strictly linear, so ">= N" is a MEANINGFUL question to ask of
// it. It is not, today, a question anything can ask in SQL: this value is a
// read-time fold over the run-event log, not a column, so it cannot appear in
// a WHERE clause. Consumer visibility therefore gates on `content_status =
// 'ready'` instead (MESITA-1228) — a real predicate, applied before the pool
// cap. If MESITA-1249 materializes this meter onto the place, a finer-grained
// ">= N" gate becomes possible; until then, do not promise one.
//
// THIS IS NOT THE TRIGGER MATRIX'S VOCABULARY. `enrich-triggers.ts` keys what a
// run may BUY (purchase units); these are what an operator is told. Different
// questions; the name overlap is a coincidence of subject.
//
// AND ABSENCE IS A RESULT, NOT A FAILURE. A place with no Instagram must still
// reach 9. The function ran, resolved "there is nothing here", and is
// `completed`.

export const PULSE_PIECES = [
  "pulse",
  "details",
  "serp",
  "links",
  "social",
  "images",
  "menu",
  "reviews",
  "description",
] as const;

/**
 * Reported, never counted. A semantic function is real work with a real outcome
 * an operator wants to see, but it is not a rung of the queue — see the header
 * for why neither sits at 10. Order follows the spec: summary, then name.
 *
 * `name` is DECLARED BUT NOT BUILT: `places` today carries a single `embedding`
 * over the whole facts block, and splitting the Mesita Name into its own vector
 * is the open build (MESITA-1238). The key exists so the day it lands it has a
 * home, and so the console can say "not built" about something real.
 */
export const PULSE_EXTRAS = ["summary", "name"] as const;

export type PulsePiece = (typeof PULSE_PIECES)[number];
export type PulseExtra = (typeof PULSE_EXTRAS)[number];
/** Anything a stage may stamp: a queue function or a semantic one. */
export type PulseStep = PulsePiece | PulseExtra;

/**
 * What level 0 is CALLED. Not a function: seed is step 1 of CREATE and the row
 * existing IS the seed, so there is no rung below pulse and nothing to stamp.
 * Clients render `PULSE_LABELS_IN_ORDER[0]` for a place no enrich function has
 * reached — which, with create stamping pulse+details, is a place whose create
 * stamps failed or that predates them.
 */
export const PULSE_FLOOR_LABEL = "Created";

/** The operator-facing name of each function. Names only — see below for why. */
const PULSE_LABELS: Record<PulsePiece, string> = {
  pulse: "Pulse",
  details: "Details",
  serp: "Serp",
  links: "Links",
  social: "Social",
  images: "Images",
  menu: "Menu",
  reviews: "Reviews",
  description: "Description",
};

export const PULSE_EXTRA_LABELS: Record<PulseExtra, string> = {
  summary: "Semantic · Summary",
  name: "Semantic · Name",
};

/**
 * THE INDEX IS DERIVED, never written down (MESITA-1222).
 *
 * It used to be nine hand-typed literals sitting beside the array that already
 * defines the order, with nothing tying the two together. `pulseHighWater`
 * iterates the ARRAY and returns the META index, so a reorder that updated only
 * one of them would yield a high-water that skips or repeats a number — and the
 * S-number written to `place_enrichment_events` would drift from the function's
 * real position. PR #1072 reordered the array and renumbered by hand and got it
 * right; nothing would have caught it if it hadn't.
 *
 * The index is `i + 1`: the ENRICH queue counts 1-9 and 0 is the CREATED
 * floor, which is not a member (MESITA-1253).
 */
export const PULSE_PIECE_META: Record<
  PulsePiece,
  { index: number; label: string }
> = Object.fromEntries(
  PULSE_PIECES.map((key, i) => [key, { index: i + 1, label: PULSE_LABELS[key] }]),
) as Record<PulsePiece, { index: number; label: string }>;

/**
 * The labels in queue order — what a client renders beside the number.
 *
 * Shipped on the admin payloads so no other package hand-copies this list.
 * web-admin carried its own positional array with no shared import, no test and
 * no CI gate; the catalog would simply have shown the wrong function name
 * beside every number if a reorder had missed it.
 *
 * INDEXED BY FUNCTION NUMBER: `labels[0]` is the CREATED floor (not a
 * function) and `labels[9]` is Description, so a reader renders
 * `labels[level]` with no off-by-one.
 */
export const PULSE_LABELS_IN_ORDER: readonly string[] = [
  PULSE_FLOOR_LABEL,
  ...PULSE_PIECES.map((k) => PULSE_PIECE_META[k].label),
];

/**
 * The complete-profile number, so nothing hardcodes 9. Nine enrich functions,
 * so it IS the array length; semantic functions are not in it, and the CREATED
 * floor (0) sits below the array.
 */
export const PULSE_TOTAL = PULSE_PIECES.length;

/** One event row, narrowed to what the high-water needs. */
export type PulseEvent = {
  step_name?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const INDEX = new Map<string, number>(
  PULSE_PIECES.map((k) => [k, PULSE_PIECE_META[k].index]),
);

/** Latest event per known function key — the log is append-only. */
function latestByPiece(
  events: readonly PulseEvent[],
): Map<string, { status: string; at: string }> {
  const latest = new Map<string, { status: string; at: string }>();
  for (const e of events) {
    const key = (e.step_name ?? "").trim();
    // Unknown keys are ignored on purpose: legacy stage beacons (`gather`,
    // `publish`), semantic functions, and the rungs of previous ladders.
    if (!INDEX.has(key)) continue;
    const at = e.created_at ?? "";
    const prev = latest.get(key);
    if (!prev || at >= prev.at) {
      latest.set(key, { status: (e.status ?? "").trim(), at });
    }
  }
  return latest;
}

/**
 * How far the queue got, 0-9.
 *
 * The index of the last function such that IT AND EVERY FUNCTION BEFORE IT
 * completed. A gap stops the count: if `links` (4) failed but `social` (5)
 * later succeeded, the answer is 3, because a profile built past a hole is a
 * profile built on incomplete data — which is the whole reason the queue is
 * linear.
 *
 * 0 is the base case, and it is the FLOOR rather than a failure: the place is
 * seeded and nothing after it has landed. `seed` is never stamped, so the walk
 * starts at function 1 — see THE FLOOR in the header for why stamping it would
 * pin the whole catalog at 0.
 *
 * Events are an APPEND-ONLY log, so only the LATEST event per function counts.
 * A re-enrich that fixes function 4 raises the number; one that breaks it
 * lowers it.
 */
export function pulseHighWater(events: readonly PulseEvent[]): number {
  const latest = latestByPiece(events);

  let high = 0;
  for (const piece of PULSE_PIECES) {
    const rec = latest.get(piece);
    // Only `completed` advances the queue. A missing function is one that has
    // never run — not a pass.
    if (!rec || rec.status !== "completed") break;
    high = PULSE_PIECE_META[piece].index;
  }
  return high;
}

/**
 * WHY the queue stopped where it did, or null when it finished.
 *
 * The high-water alone is ambiguous at every level, and MESITA-1243 made that
 * ambiguity load-bearing at 0: function 1 now FAILS a place Google reports
 * permanently closed, so 0 stopped meaning only "seeded, nothing tried" and
 * started also meaning "we asked, and the listing is dead". Two facts, one
 * number — the exact thing this ladder exists to prevent.
 *
 * So the number ships with its reason. `failed` = the function ran and could
 * not do its job. `missing` = it has no event at all, which for a fresh place
 * is simply "not yet" and for a stalled one is "the run never got here".
 *
 * Derived from the same events the high-water walks, so the two can never
 * disagree — do not let a caller compute this from the number alone.
 */
export type PulseBlock = {
  key: PulsePiece;
  index: number;
  status: "failed" | "missing";
};

export function pulseBlockedAt(
  events: readonly PulseEvent[],
): PulseBlock | null {
  const latest = latestByPiece(events);
  for (const piece of PULSE_PIECES) {
    const rec = latest.get(piece);
    if (rec?.status === "completed") continue;
    return {
      key: piece,
      index: PULSE_PIECE_META[piece].index,
      // Anything that is not `completed` and not absent — `failed`, or the
      // `skipped` a legacy row might carry — is the function having run and
      // not delivered. Only a total absence of events is "not yet".
      status: rec ? "failed" : "missing",
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
export function completedPulsePieces(
  events: readonly PulseEvent[],
): PulsePiece[] {
  const latest = latestByPiece(events);
  return PULSE_PIECES.filter((p) => latest.get(p)?.status === "completed");
}
