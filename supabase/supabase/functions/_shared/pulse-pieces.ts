// PULSE — the enrichment pipeline, as TEN sequential steps plus one extra
// (MESITA-1230).
//
// Pato, 2026-08-22: "the thing you need to call pulse is the enrichment
// pipeline." The six-fact box that used to wear this name is Status again
// (MESITA-1206); Pulse is the queue below, and `pulse` is also its first step —
// the liveness read that used to be called `status`.
//
//   S0 seed       NOT A STEP — the pre-run gate. A google_place_id must already
//                 resolve or the queue cannot start at all, which is why its
//                 absence is a hard stop rather than a failed step. 0 means the
//                 seed is in place and nothing after it has landed.
//
//    1 pulse      is this place ALIVE — open/closed and the weekly hours
//    2 details    the rest of the Google spine: address, geo, zone, city,
//                 country, TIMEZONE, price, rating, website, phone
//    3 name       the google_name refresh behind the generated places.name
//    4 serp       the SERP Summary — Agent X's soft editorial read
//    5 links      website · instagram · facebook · opentable · ubereats
//    6 social     the Instagram / Facebook gathers
//    7 images     the vision funnel, which ranks the pools SOCIAL filled
//    8 menu       STUB — no source today, so it can never block the queue
//    9 reviews    Google reviews
//   10 description the Profile Description, then category, then tags
//
//   extra semantics   the Semantic Summary + the vector — OUTSIDE the queue
//
// WHY SEMANTICS IS AN EXTRA AND NOT STEP 11. The same machinery fires on any
// profile edit (the On-Update path), so it is not a stage of enriching a place
// — it is a thing that happens whenever the text changes. Counting it would
// make `enriched` drop when someone edits a name, which is not "how far did the
// queue get". It is reported so an operator can see it; it is never counted.
//
// THE ORDER IS LOAD-BEARING. `serp` runs BEFORE `links` because Agent Y selects
// channel links against the SERP Summary's context. `social` runs BEFORE
// `images` because the Instagram/Facebook gathers fill the pools the vision
// funnel ranks — images any earlier would rank Google photos and nothing else.
// `menu` sits after `links` (its source) and before `description` (which would
// read it). `description` CLOSES the queue, and the semantics extra runs after
// it, vectorising the text the queue just wrote.
//
// THE THREE TEXTS, each with exactly one reader, never collapsed:
//   SERP Summary        step 4  — soft context the PIPELINE reads
//   Profile Description step 10 — places.description, what a GUEST reads
//   Semantic Summary    extra   — embedding_source_text, what the INDEX reads
// Embedding the Profile Description would bloat a 1536-d vector with a thousand
// words of narrative; showing the Semantic Summary to a guest would shrink the
// profile to a stub.
//
// `enriched` is NOT a count of steps that worked. It is HOW FAR THE QUEUE GOT:
// the index of the last good step, 0-10. That is what makes it gateable — Map
// and Swipe can ask for >= N only because the queue is strictly linear.
//
// THIS IS NOT THE TRIGGER MATRIX'S VOCABULARY. `enrich-triggers.ts` keys what a
// run may BUY (google · reviews · serp · links · social · images · synthesis ·
// photos · embedding); those are purchase units and they stay. Pulse steps are
// what an operator is told. The two are different questions and the overlap in
// names is a coincidence of subject, not a shared list.
//
// WHY A STEP NOT BOUGHT WRITES NOTHING (MESITA-1172 blocker 2). The matrix lets
// a run buy a subset, so a cheap liveness refresh never walks 1→10 and "how far
// did you get" would be meaningless for it. Per-step state is what resolves
// that: a run reports only the steps it actually ran, and a step it did not buy
// keeps whatever a PREVIOUS run recorded. State accumulates across runs instead
// of being reset by the cheapest one.
//
// AND ABSENCE IS A RESULT, NOT A FAILURE. A place with no Instagram must still
// reach 10. The step ran, resolved "there is nothing here", and is `completed`.
// Recording that as a failure would punish a place for a fact about the world.

export const PULSE_PIECES = [
  "pulse",
  "details",
  "name",
  "serp",
  "links",
  "social",
  "images",
  "menu",
  "reviews",
  "description",
] as const;

/**
 * Reported, never counted. An extra is real work with a real outcome an
 * operator wants to see, but it is not a rung of the queue — see the header for
 * why semantics sits out here rather than at 11.
 */
export const PULSE_EXTRAS = ["semantics"] as const;

export type PulsePiece = (typeof PULSE_PIECES)[number];
export type PulseExtra = (typeof PULSE_EXTRAS)[number];
/** Anything a stage may stamp: a queue step or an extra. */
export type PulseStep = PulsePiece | PulseExtra;

/** The operator-facing name of each piece. Names only — see below for why. */
const PULSE_LABELS: Record<PulsePiece, string> = {
  pulse: "Pulse",
  details: "Details",
  name: "Name",
  serp: "Serp",
  links: "Links",
  social: "Social",
  images: "Images",
  menu: "Menu",
  reviews: "Reviews",
  description: "Description",
};

export const PULSE_EXTRA_LABELS: Record<PulseExtra, string> = {
  semantics: "Semantics",
};

/**
 * THE INDEX IS DERIVED, never written down (MESITA-1222).
 *
 * It used to be nine hand-typed literals sitting beside the array that already
 * defines the order, with nothing tying the two together. `pulseHighWater`
 * iterates the ARRAY and returns the META index, so a reorder that updated only
 * one of them would yield a high-water that skips or repeats a number — and the
 * S-number written to `place_enrichment_events` would drift from the rung's real
 * position. PR #1072 reordered the array and renumbered by hand and got it
 * right; nothing would have caught it if it hadn't.
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
 * no CI gate; the catalog would simply have shown the wrong rung name beside
 * every number if a reorder had missed it.
 */
export const PULSE_LABELS_IN_ORDER: readonly string[] = PULSE_PIECES.map(
  (k) => PULSE_PIECE_META[k].label,
);

/** The total, so nothing hardcodes 10. Extras are NOT in it. */
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

/**
 * How far the queue got, 0-10.
 *
 * The index of the last piece such that IT AND EVERY PIECE BEFORE IT completed.
 * A gap stops the count: if `links` (5) failed but `social` (6) later
 * succeeded, the answer is 4, because a profile built past a hole is a profile
 * built on incomplete data — which is the whole reason the queue is linear.
 *
 * Events are an APPEND-ONLY log, so only the LATEST event per piece counts. A
 * re-enrich that fixes piece 4 raises the number; one that breaks it lowers it.
 */
export function pulseHighWater(events: readonly PulseEvent[]): number {
  const latest = new Map<string, { status: string; at: string }>();

  for (const e of events) {
    const key = (e.step_name ?? "").trim();
    if (!INDEX.has(key)) continue; // legacy stage beacons, and anything unknown
    const at = e.created_at ?? "";
    const prev = latest.get(key);
    if (!prev || at >= prev.at) {
      latest.set(key, { status: (e.status ?? "").trim(), at });
    }
  }

  let high = 0;
  for (const piece of PULSE_PIECES) {
    const rec = latest.get(piece);
    // Only `completed` advances the queue. A missing piece is one that has
    // never run — not a pass.
    if (!rec || rec.status !== "completed") break;
    high = PULSE_PIECE_META[piece].index;
  }
  return high;
}

/** Every piece that has completed, in order — for a per-piece readout. */
export function completedPulsePieces(
  events: readonly PulseEvent[],
): PulsePiece[] {
  const latest = new Map<string, string>();
  const at = new Map<string, string>();
  for (const e of events) {
    const key = (e.step_name ?? "").trim();
    if (!INDEX.has(key)) continue;
    const t = e.created_at ?? "";
    if (!at.has(key) || t >= (at.get(key) ?? "")) {
      at.set(key, t);
      latest.set(key, (e.status ?? "").trim());
    }
  }
  return PULSE_PIECES.filter((p) => latest.get(p) === "completed");
}
