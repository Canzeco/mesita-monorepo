// PULSE — the enrichment machinery, as TWO FLOWS over SHARED FUNCTIONS
// (Main §8.4). Two sequences — not one global enum:
//
//   CREATE (ONE FUNCTION, awaits four subfunctions):
//     1 seed → 2 pulse → 3 details → 4 semantic
//   ENRICH (TEN FUNCTIONS, sequential ticks, none await a nested run):
//     1 pulse → 2 details → 3 serp → 4 links → 5 social
//     → 6 images → 7 menu → 8 reviews → 9 description → 10 semantic
//
// Pulse, Details and Semantic appear in BOTH flows because they are SHARED
// FUNCTIONS with two callers: CREATE awaits them inline (a place is born with
// its liveness checked, its Google spine persisted, and both vectors written),
// ENRICH runs them as ticks (a place is refreshed). Seed is NOT an enrich
// function at all — it is step 1 of CREATE, and the row existing IS the seed.
// That is why this array starts at pulse and why `enriched = 0` means CREATED:
// the place exists and no enrich function has completed. The 0 is the
// persistence floor, not Create's number for Seed.
//
// CREATE IS A RUN LIKE ANY OTHER. It stamps the functions it actually ran
// (pulse, details — and semantic when the vector write lands), so a healthy
// fresh place reads 2/10 the moment it exists, and state accumulates across
// create and every later run under one rule. Semantic is 10, so a create
// stamp does not jump the high-water past 2: 3–9 are still a gap. A function
// a run did not buy writes NOTHING (MESITA-1172 blocker 2) — that rule is
// what lets two callers share one ladder.
//
// SEMANTICS IS FUNCTION 10. One function writes the Mesita Name vector AND
// the Semantic Summary vector together. It CLOSES the enrich queue. The
// On-Update path fires the same machinery when an operator edits the profile:
// a successful re-embed keeps 10; a failed one drops to 9. Both vectors are
// BUILT (MESITA-1238): `places.name_embedding` and `places.embedding`.
//
// RENUMBERING IS SURVIVABLE BECAUSE NOTHING MATCHES ON THE NUMBER. The reader
// keys on `step_name` (the function KEY); the `S<n>` written beside it is
// decorative. Dropping `seed` from this array moved NO number: pulse was
// already 1 and description already 9. Rows from every previous ladder still
// count correctly; retired keys (`name` as a rung, `semantics`, `seed` if any
// ever existed) fall out of the walk. Legacy `name`/`summary` extras fold
// into `semantic` on read.
//
// THE ORDER IS LOAD-BEARING. `serp` runs BEFORE `links` because that is what
// serp is FOR: Agent Y cannot pick between five Instagram candidates on a name
// and a city, and the editorial read is what tells it which one is really this
// place. Function 9 grounding on the same text is a SECOND USE of something
// bought for the first — do not reorder the queue to serve it. `social` runs
// BEFORE `images` because the Instagram/Facebook gathers fill the pools the
// vision funnel ranks. `menu` sits after `links` (its source) and before
// `description` (which would read it). `description` is 9; Semantics CLOSES
// the queue at 10, vectorising the name and the text function 9 just wrote.
//
// THE THREE TEXTS, each with exactly one reader, never collapsed:
//   SERP Summary        function 3 — soft context the PIPELINE reads
//   Presentation        function 9 — places.description, what a GUEST reads
//   Semantic Summary    function 10 — embedding_source_text, what the INDEX reads
//
// `enriched` is NOT a count of functions that worked. It is HOW FAR THE QUEUE
// GOT: the index of the last good function, 0-10, where 0 is the CREATED floor
// and 10 is a complete profile including both vectors. The queue is strictly
// linear, so ">= N" is a MEANINGFUL question to ask of it. It is not, today, a
// question anything can ask in SQL: this value is a read-time fold over the
// run-event log, not a column, so it cannot appear in a WHERE clause. Consumer
// visibility therefore gates on `content_status = 'ready'` instead
// (MESITA-1228) — a real predicate, applied before the pool cap.
//
// THIS IS NOT THE TRIGGER MATRIX'S VOCABULARY. `enrich-triggers.ts` keys what a
// run may BUY (purchase units); these are what an operator is told. Different
// questions; the name overlap is a coincidence of subject.
//
// AND ABSENCE IS A RESULT, NOT A FAILURE. A place with no Instagram must still
// reach 10. The function ran, resolved "there is nothing here", and is
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
  "embedding",
] as const;

/**
 * Retired extra keys. Empty: Embedding is function 10, not an unnumbered
 * extra. Kept as an array so FUNCTION_STATE_KEYS can still spread it.
 */
export const PULSE_EXTRAS = [] as const;

/** Pre-merge event / map keys. Folded into `embedding` on read (display). */
export const PULSE_EXTRA_ALIASES = ["summary", "name"] as const;

/**
 * RENAMED function keys: the same function under its old name. Unlike the
 * display-only extras above, a rename COUNTS everywhere — the ladder walk,
 * the stored map merge, the Status fold — because function 10 did not
 * change, only its name did (§8.4 v3: Semantic → Embedding, 2026-08-29).
 * NOTE the vocabulary firewall: `embedding` is also a trigger-matrix
 * subprocess key — a coincidence of subject, not a shared enum; neither
 * list may import the other.
 */
export const PULSE_RENAMES: Readonly<Record<string, PulsePiece>> = {
  semantic: "embedding",
};

export type PulsePiece = (typeof PULSE_PIECES)[number];
export type PulseExtra = (typeof PULSE_EXTRAS)[number];
/** Anything a stage may stamp: a queue function. */
export type PulseStep = PulsePiece | PulseExtra;

/**
 * What level 0 is CALLED on the meter: Created. Seed is Create step 1, never
 * stamped, never an enrich rung. The row existing IS the seed, so there is
 * no enrich rung below pulse. 0 on the meter is the persistence floor.
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
  embedding: "Embedding",
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
 * The index is `i + 1`: the ENRICH queue counts 1-10 and 0 is the CREATED
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
 * function) and `labels[10]` is Semantics, so a reader renders
 * `labels[level]` with no off-by-one.
 */
export const PULSE_LABELS_IN_ORDER: readonly string[] = [
  PULSE_FLOOR_LABEL,
  ...PULSE_PIECES.map((k) => PULSE_PIECE_META[k].label),
];

/**
 * The complete-profile number, so nothing hardcodes 10. Ten enrich functions,
 * so it IS the array length; the CREATED floor (0) sits below the array.
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
    const raw = (e.step_name ?? "").trim();
    // Renamed keys COUNT (the function is the same; only the name moved):
    // a stored `semantic` event is function 10 under its old name.
    const key = PULSE_RENAMES[raw] ?? raw;
    // Unknown keys are ignored on purpose: legacy stage beacons (`gather`,
    // `publish`), retired rungs (`semantics`), and pre-merge `name`/`summary`
    // extras (those fold into `embedding` on the Status map, not this walk —
    // an old `name` rung must not count as function 10).
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
 * How far the queue got, 0-10.
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
 * pin the whole catalog at 0. Embedding is 10: a place that finished
 * description without vectors reads 9.
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
