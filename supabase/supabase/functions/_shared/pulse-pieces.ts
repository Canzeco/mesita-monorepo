// PULSE — the enrichment pipeline, as nine sequential pieces (MESITA-1172).
//
// Pato, 2026-08-22: "the thing you need to call pulse is the enrichment
// pipeline." The six-fact box that used to wear this name is Status again
// (MESITA-1206); Pulse is the queue below.
//
//   S0 seed      NOT A STEP — the pre-run gate. A google_place_id must already
//                resolve or the queue cannot start at all, which is why its
//                absence is a hard stop rather than a failed step. 0 means the
//                seed is in place and nothing after it has landed.
//
//   1 pulse      is this place ALIVE — hours, closes_at, timezone
//   2 details    the rest of the Google spine: address, geo, zone, city,
//                price, phone, website
//   3 links      website · instagram · facebook · opentable · ubereats
//   4 social     the Instagram / Facebook gathers
//   5 images     the vision funnel, which ranks the pools SOCIAL filled
//   6 menu       STUB — no source today, so it can never block the queue
//   7 reviews    Google reviews
//   8 semantics  About, then category, then tags
//   9 embeddings the 60-word Place Synthesis blurb → the vector
//
// THE ORDER IS LOAD-BEARING. `social` runs BEFORE `images` because the
// Instagram/Facebook gathers fill the pools the vision funnel ranks — images
// any earlier would rank Google photos and nothing else. `menu` sits after
// `links` (its source) and before `semantics` (which would read it).
// `embeddings` runs LAST because it vectorizes the text `semantics` just
// wrote; any earlier and it vectorizes the previous profile.
//
// SEMANTICS ≠ EMBEDDINGS. The About is prose a guest reads; the embedded text
// is `places.embedding_source_text`, a 60-word blurb written for the index.
// Two artifacts, two purposes — collapsing them either bloats the vector with
// a thousand words of narrative or shrinks the profile to a stub.
//
// `enriched` is NOT a count of pieces that worked. It is HOW FAR THE QUEUE GOT:
// the index of the last good piece, 0-9. That is what makes it gateable — Map
// and Swipe can ask for ≥ N only because the queue is strictly linear.
//
// THIS IS NOT THE TRIGGER MATRIX'S VOCABULARY. `enrich-triggers.ts` keys what a
// run may BUY (google · reviews · serp · links · social · images · synthesis ·
// photos · embedding); those are purchase units and they stay. Pulse pieces are
// what an operator is told. The two are different questions and the overlap in
// names is a coincidence of subject, not a shared list.
//
// WHY A PIECE NOT BOUGHT WRITES NOTHING (MESITA-1172 blocker 2). The matrix
// lets a run buy a subset, so a cheap liveness refresh never walks 1→9 and
// "how far did you get" would be meaningless for it. Per-piece state is what
// resolves that: a run reports only the pieces it actually ran, and a piece it
// did not buy keeps whatever a PREVIOUS run recorded. State accumulates across
// runs instead of being reset by the cheapest one.
//
// AND ABSENCE IS A RESULT, NOT A FAILURE. A place with no Instagram must still
// reach 9. The piece ran, resolved "there is nothing here", and is `completed`.
// Recording that as a failure would punish a place for a fact about the world.

export const PULSE_PIECES = [
  "pulse",
  "details",
  "links",
  "social",
  "images",
  "menu",
  "reviews",
  "semantics",
  "embeddings",
] as const;

export type PulsePiece = (typeof PULSE_PIECES)[number];

export const PULSE_PIECE_META: Record<
  PulsePiece,
  { index: number; label: string }
> = {
  pulse: { index: 1, label: "Pulse" },
  details: { index: 2, label: "Details" },
  links: { index: 3, label: "Links" },
  social: { index: 4, label: "Social" },
  images: { index: 5, label: "Images" },
  menu: { index: 6, label: "Menu" },
  reviews: { index: 7, label: "Reviews" },
  semantics: { index: 8, label: "Semantics" },
  embeddings: { index: 9, label: "Embeddings" },
};

/** The total, so nothing hardcodes 9. */
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
 * How far the queue got, 0-9.
 *
 * The index of the last piece such that IT AND EVERY PIECE BEFORE IT completed.
 * A gap stops the count: if `links` (4) failed but `social` (6) later
 * succeeded, the answer is 3, because a profile built past a hole is a profile
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
