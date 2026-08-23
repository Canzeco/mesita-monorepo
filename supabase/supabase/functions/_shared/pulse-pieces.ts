// PULSE — the enrichment pipeline, as TWELVE functions: TEN in a linear queue
// numbered 0-9, plus TWO SEMANTIC functions that sit outside it (MESITA-1243).
//
// Pato, 2026-08-22: "the thing you need to call pulse is the enrichment
// pipeline." The six-fact box that used to wear this name is Status again
// (MESITA-1206); Pulse is the queue below, and `pulse` is also its first step —
// the liveness read that used to be called `status`.
//
//    0 seed       the gate the queue stands on — see THE FLOOR below
//    1 pulse      is this place still ACTIVE. One question, one answer
//    2 details    the Google spine: the HOURS, address, geo, zone, city,
//                 country, TIMEZONE, price, rating, website, phone — and
//                 `google_name`, the label behind the generated `places.name`
//    3 serp       the SERP Summary — Agent X's soft editorial read, bought to
//                 give function 4 something to recognise a place by
//    4 links      website · instagram · facebook · opentable · ubereats
//    5 social     the Instagram / Facebook gathers
//    6 images     the vision funnel, which ranks the pools SOCIAL filled
//    7 menu       STUB — no source today, so it can never block the queue
//    8 reviews    Google reviews
//    9 description the PRESENTATION, then category, then tags. The function is
//                 named `description` after the column it writes; the ARTIFACT
//                 an operator and a guest see is the Presentation
//
//   semantic name     the Mesita Name as its own vector — NOT BUILT YET
//   semantic summary  the Semantic Summary + its vector
//
// THE FLOOR. `seed` is function 0 and it is NEVER STAMPED — the paired
// places/projects row EXISTING is the seed, so there is no separate effect to
// observe. `pulseHighWater` therefore walks from function 1 and returns 0 as
// its base case, which is exactly what 0 has always meant: seeded, and nothing
// after it has landed. A Place ID that does not resolve produces no row at all,
// so 0 is a FLOOR, never a failure. Stamping it would be worse than redundant:
// every place created before such a beacon existed would have no seed event,
// the walk would break at function 0, and the entire catalog would read 0
// forever — silently, because beacons swallow their own errors. The type of
// `reportPulsePieces` excludes it so that cannot be written by accident.
//
// WHY NAME IS A SEMANTIC FUNCTION AND NOT A RUNG (it was rung 3 until now).
// The `google_name` refresh is a field on the function-2 Place Details call
// like any other, so it has no rung of its own. What DOES deserve a name is the
// Mesita Name as a VECTOR — and that cannot be a rung, because the On-Update
// path fires the same machinery whenever an operator edits `mesita_name`, and
// `enriched` must not fall because someone renamed a place. Same reason
// `summary` is not rung 10. Counting either would stop answering "how far did
// the queue get".
//
// RENUMBERING IS SURVIVABLE BECAUSE NOTHING MATCHES ON THE NUMBER. The reader
// keys on `step_name` (the function KEY); the `S<n>` written beside it is
// decorative. So the rows this pipeline wrote under the previous ladder still
// count correctly: `pulse`, `details`, `serp`, `links`, `social`, `images`,
// `menu`, `reviews` and `description` are the same keys at new positions, and
// their stale `S<n>` is ignored. Old `name` rows (stamped S3 when name was a
// rung) and old `semantics` rows fall out of the walk entirely, which is right
// — neither is a rung any more. No backfill, and none is wanted.
//
// THE ORDER IS LOAD-BEARING. `serp` runs BEFORE `links` because that is what
// serp is FOR: Agent Y cannot pick between five Instagram candidates on a name
// and a city, and the editorial read is what tells it which one is really this
// place. Function 9 grounding on the same text is a SECOND USE of something
// bought for the first — do not reorder the queue to serve it. `social` runs
// BEFORE `images` because the Instagram/Facebook gathers fill the pools the
// vision funnel ranks — images any earlier would rank Google photos and nothing
// else. `menu` sits after `links` (its source) and before `description` (which
// would read it). `description` CLOSES the queue at 9, and the semantic
// functions run after it, vectorising the text the queue just wrote.
//
// THE THREE TEXTS, each with exactly one reader, never collapsed:
//   SERP Summary        function 3 — soft context the PIPELINE reads
//   Presentation        function 9 — places.description, what a GUEST reads
//   Semantic Summary    semantic   — embedding_source_text, what the INDEX reads
// Embedding the Presentation would bloat a 1536-d vector with a thousand
// words of narrative; showing the Semantic Summary to a guest would shrink the
// profile to a stub.
//
// `enriched` is NOT a count of functions that worked. It is HOW FAR THE QUEUE
// GOT: the index of the last good function, 0-9. That is what makes it gateable
// — Map and Swipe can ask for >= N only because the queue is strictly linear.
//
// THIS IS NOT THE TRIGGER MATRIX'S VOCABULARY. `enrich-triggers.ts` keys what a
// run may BUY (google · reviews · serp · links · social · images · synthesis ·
// photos · embedding); those are purchase units and they stay. Pulse functions
// are what an operator is told. The two are different questions and the overlap
// in names is a coincidence of subject, not a shared list.
//
// WHY A FUNCTION NOT BOUGHT WRITES NOTHING (MESITA-1172 blocker 2). The matrix
// lets a run buy a subset, so a cheap liveness refresh never walks 1→9 and "how
// far did you get" would be meaningless for it. Per-function state is what
// resolves that: a run reports only the functions it actually ran, and one it
// did not buy keeps whatever a PREVIOUS run recorded. State accumulates across
// runs instead of being reset by the cheapest one.
//
// AND ABSENCE IS A RESULT, NOT A FAILURE. A place with no Instagram must still
// reach 9. The function ran, resolved "there is nothing here", and is
// `completed`. Recording that as a failure would punish a place for a fact
// about the world.

export const PULSE_PIECES = [
  "seed",
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
 * for why neither sits at 10.
 *
 * `name` is DECLARED BUT NOT BUILT: `places` today carries a single `embedding`
 * over the whole facts block, and splitting the Mesita Name into its own vector
 * is the open build (MESITA-1238). The key exists so the day it lands it has a
 * home, and so the console can say "not built" about something real.
 */
export const PULSE_EXTRAS = ["name", "summary"] as const;

export type PulsePiece = (typeof PULSE_PIECES)[number];
export type PulseExtra = (typeof PULSE_EXTRAS)[number];
/** Anything a stage may stamp: a queue function or a semantic one. */
export type PulseStep = PulsePiece | PulseExtra;

/**
 * Function 0. Never stamped, never walked — the row existing IS the seed.
 * Exported so the walk, the report type and the tests all name the same thing
 * instead of three of them hardcoding "seed".
 */
export const PULSE_FLOOR = "seed" as const satisfies PulsePiece;

/** The operator-facing name of each function. Names only — see below for why. */
const PULSE_LABELS: Record<PulsePiece, string> = {
  seed: "Seed",
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
  name: "Semantic · Name",
  summary: "Semantic · Summary",
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
 * The index is the ARRAY INDEX now, not `i + 1`: `seed` is function 0 and the
 * queue counts from it, so the two are the same number by construction.
 */
export const PULSE_PIECE_META: Record<
  PulsePiece,
  { index: number; label: string }
> = Object.fromEntries(
  PULSE_PIECES.map((key, i) => [key, { index: i, label: PULSE_LABELS[key] }]),
) as Record<PulsePiece, { index: number; label: string }>;

/**
 * The labels in queue order — what a client renders beside the number.
 *
 * Shipped on the admin payloads so no other package hand-copies this list.
 * web-admin carried its own positional array with no shared import, no test and
 * no CI gate; the catalog would simply have shown the wrong function name
 * beside every number if a reorder had missed it.
 *
 * INDEXED BY FUNCTION NUMBER: `labels[0]` is Seed and `labels[9]` is
 * Description, so a reader renders `labels[level]` with no off-by-one.
 */
export const PULSE_LABELS_IN_ORDER: readonly string[] = PULSE_PIECES.map(
  (k) => PULSE_PIECE_META[k].label,
);

/**
 * The complete-profile number, so nothing hardcodes 9.
 *
 * It is the LAST INDEX, not the array length: `seed` occupies 0, so ten
 * functions top out at 9. Semantic functions are not in it.
 */
export const PULSE_TOTAL = PULSE_PIECES.length - 1;

/** One event row, narrowed to what the high-water needs. */
export type PulseEvent = {
  step_name?: string | null;
  status?: string | null;
  created_at?: string | null;
};

/** The functions the walk actually inspects — everything above the floor. */
const WALKED: readonly PulsePiece[] = PULSE_PIECES.filter(
  (p) => p !== PULSE_FLOOR,
);

const INDEX = new Map<string, number>(
  WALKED.map((k) => [k, PULSE_PIECE_META[k].index]),
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
  for (const piece of WALKED) {
    const rec = latest.get(piece);
    // Only `completed` advances the queue. A missing function is one that has
    // never run — not a pass.
    if (!rec || rec.status !== "completed") break;
    high = PULSE_PIECE_META[piece].index;
  }
  return high;
}

/**
 * Every function that has completed, in order — for a per-function readout.
 *
 * The floor is always included: this is called about a place that exists, and a
 * place that exists is seeded. Unlike the high-water it does NOT stop at a gap
 * — it answers "which ones landed", not "how far did the queue get".
 */
export function completedPulsePieces(
  events: readonly PulseEvent[],
): PulsePiece[] {
  const latest = latestByPiece(events);
  return [
    PULSE_FLOOR,
    ...WALKED.filter((p) => latest.get(p)?.status === "completed"),
  ];
}
