// PULSE — the enrichment pipeline, as nine sequential pieces (MESITA-1172).
//
// Pato, 2026-08-22: "the thing you need to call pulse is the enrichment
// pipeline." The six-fact box that used to wear this name is Status again
// (MESITA-1206); Pulse is the queue below.
//
//   1 seed        a google_place_id resolves — nothing runs without it
//   2 status      open/closed and the weekly hours
//   3 details     phone, address, price, category, zone
//   4 links       website · instagram · facebook · opentable · ubereats
//   5 menu        STUB — no implementation, so it can never block the queue
//   6 social      the Instagram / Facebook gathers
//   7 images      the vision funnel, which ranks the pools social filled
//   8 reviews     Google reviews
//   9 semantics   About, category, tags, embedding
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
  "seed",
  "status",
  "details",
  "links",
  "menu",
  "social",
  "images",
  "reviews",
  "semantics",
] as const;

export type PulsePiece = (typeof PULSE_PIECES)[number];

export const PULSE_PIECE_META: Record<
  PulsePiece,
  { index: number; label: string }
> = {
  seed: { index: 1, label: "Seed" },
  status: { index: 2, label: "Status" },
  details: { index: 3, label: "Details" },
  links: { index: 4, label: "Links" },
  menu: { index: 5, label: "Menu" },
  social: { index: 6, label: "Social" },
  images: { index: 7, label: "Images" },
  reviews: { index: 8, label: "Reviews" },
  semantics: { index: 9, label: "Semantics" },
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
