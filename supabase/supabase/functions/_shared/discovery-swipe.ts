// Scroll ranking — Places Lineup under the locked Swipe mask (Pato, 2026-08-28).
//
// The engine key stays `swipe`; the surface is Home's Scroll pill since
// MESITA-1697. Admission cuts first, tiers band what survives (MESITA-2047),
// then the blend scores each band under
// the Scroll column of `weightsByMode` under the Scroll mask: proximity,
// timing, category, popularity, enriched, partnered, randomness. Name,
// Summary and Social stay 0. The 2026-08-26 two-signal SUM and its
// partnerBias / randomnessMax multipliers are gone — MESITA-1859 deleted
// those five unread fields off the blob rather than leave them beside a live
// per-mode exponent.
//
//   1. ADMIT  — ready, review floor, Map type batteries, then guest
//               predicates. These EXCLUDE.
//   2. TIER   — open now + closing buffer, the operator radius, and the
//               Proximity reach. These ORDER IN BANDS and never exclude
//               (MESITA-2047): open-and-near leads, then open within reach,
//               closed within reach, beyond reach (nearest first), unplaced.
//   3. RANK   — Places Lineup Π s^w with the Swipe mask, inside each tier.
//   4. SLOT   — the bought lane: every Nth position is a slot a promoting
//               place is MOVED FORWARD into. MESITA-1855. Inside each tier.
//
// LANE 2 RUNS HERE (MESITA-1855). Until then `slotPromoted` had no production
// caller anywhere — three tests asserted the absence — so the retired
// `mesita_level` exponent was the only live path from what a place pays to
// where it ranks. That is the
// thing the two-lane split exists to prevent: money is supposed to buy a
// POSITION, and the position pass was dead code. Scroll is where it belongs,
// because Scroll is a single ranked deck, which is exactly what slotPromoted
// takes. Map slots inside each of its listed lanes instead (nearby-lineup.ts).
//
// Distance is Haversine inside the Proximity signal. No Google call.
// Category abstains when the guest sent no intent (the usual Swipe case).

import { isOpenNow } from "./local-time-open.ts";
import { haversineKm } from "./geo.ts";
import { PROXIMITY_MAX_KM } from "./discovery-signals.ts";
import {
  discoveryRank,
  type SignalParamsByKey,
  type SignalWeights,
  type SlottingConfig,
} from "./discovery-blend.ts";
import { weightsForMode } from "./discovery-matrix.ts";
import { toLineupPlace, toPromotingFields } from "./discovery-place.ts";
import type {
  DiscoveryConfig,
  DiscoveryFilters,
  SwipeConfig,
} from "./discovery-config.ts";
import { familiesForPlace } from "./place-taxonomy.ts";

/** Query predicates Swipe owns. Map type batteries stay a separate cut. */
export function swipeAdmissionFilters(swipe: SwipeConfig): DiscoveryFilters {
  return {
    requireReady: true,
    minRating: 0,
    minReviews: swipe.minReviews,
    maxDistanceKm: swipe.radiusKm,
  };
}

/**
 * The sit-down window: open now, and still open after the closing buffer.
 * Unknown hours / unresolvable clock → false, because "cannot tell" is not
 * "open", and the strict tier promises a table right now.
 */
export function swipeOpenThrough(
  hours: unknown,
  lng: number | null,
  bufferMin: number,
  at: Date = new Date(),
): boolean {
  if (isOpenNow(hours, lng, at) !== true) return false;
  if (!(bufferMin > 0)) return true;
  const later = new Date(at.getTime() + bufferMin * 60_000);
  return isOpenNow(hours, lng, later) === true;
}

// ── Tiers (MESITA-2047) ──────────────────────────────────────────────────────
//
// OPEN-NOW AND THE RADIUS ORDER THE DECK; THEY DO NOT EMPTY IT. Until
// MESITA-2047 both were hard cuts, so a catalog of one brunch spot served
// Scroll a blank "No places yet" every evening and all day on its closed
// weekday — the place was live, ready and well reviewed, and the engine hid it
// because nobody could sit down there at 21:54. Pato, live: "Make Scroll
// functional, even if there is only one place."
//
// A TIER IS NEITHER A FILTER NOR A SIGNAL. A filter excludes; a signal demotes
// inside one ranking, where merit can still interleave (Timing floors a closed
// place at 0.2, not 0, and Proximity is a flat 0 past 25 km, so a merged
// ranking would put a great closed place above a fair open one). A tier is a
// hard BAND: every strict row precedes every backfill row, whatever they
// score. That is what keeps the change invisible at scale — with 50 open
// places inside the radius, no backfill row is ever reached.
//
// QUALITY FLOORS AND GUEST PREDICATES STAY EXCLUSIONS. Ready, the review floor
// and the Map type batteries decide what a Mesita card IS; a guest's own
// filter (including a legacy binary's "open now") is a promise to that guest.
// Neither is tiered — only the two gates that answer "right here, right now".

/** Where a place sits against Scroll's soft gates. */
export type SwipeTier =
  | "strict"
  | "openReach"
  | "closedReach"
  | "beyond"
  | "unplaced";

/**
 * Band order. Three distances — inside the radius, inside REACH (where
 * Proximity still scores anything), beyond it — with open before closed where
 * open still means a table tonight.
 *
 * Open-within-reach beats closed-nearby: a table you can have 8 km away is
 * worth more tonight than one 1 km away that is shut. Closed-within-reach
 * beats anything beyond: a bar open 360 km away is not a table tonight
 * either, and the guest's own city, even shut, is the more useful card.
 * BEYOND REACH IS ONE BAND, NEAREST FIRST, open or not — the next city is the
 * next city — and it is never Lineup-ranked (see `SWIPE_DISTANCE_ORDERED`).
 * `unplaced` is last: with a located guest, a place with no coordinates
 * cannot say where it is, and Proximity would otherwise score it above every
 * real place past reach (missingGeo 0.35 beats 0).
 */
export const SWIPE_TIER_ORDER: readonly SwipeTier[] = [
  "strict",
  "openReach",
  "closedReach",
  "beyond",
  "unplaced",
];

/**
 * Bands served in distance order, not Lineup order. Past reach Proximity is a
 * flat 0, so the blend has nothing about distance left to say — and the
 * wider-ask stop rule (`widenSwipePool`) is only exact if the rows it has not
 * fetched yet, all farther away, cannot rank above the ones it has.
 */
export const SWIPE_DISTANCE_ORDERED: ReadonlySet<SwipeTier> = new Set([
  "beyond",
]);

export type SwipeTiers<T> = Record<SwipeTier, T[]>;

/**
 * Reach: the distance where the Scroll column's Proximity curve hits 0 — the
 * operator's own `proximity.maxKm`, never less than the radius. Past it every
 * place scores the same on distance, so "beyond reach" is where a guest's
 * nearest city ends as far as the engine can tell.
 */
export function swipeReachKm(
  radiusKm: number,
  params?: SignalParamsByKey,
): number {
  const v = params?.proximity?.maxKm;
  const reach = typeof v === "number" && Number.isFinite(v) && v > 0
    ? v
    : PROXIMITY_MAX_KM;
  return Math.max(radiusKm, reach);
}

export type SwipeTierOpts<T> = {
  /** The guest, when they sent coordinates. null = every row is "near". */
  geo: { lat: number; lng: number } | null;
  radiusKm: number;
  /** See `swipeReachKm`. Clamped up to `radiusKm`. */
  reachKm: number;
  bufferMin: number;
  hoursOf: (row: T) => unknown;
  latOf: (row: T) => number | null;
  lngOf: (row: T) => number | null;
  at?: Date;
};

/** Guest → row in km. Infinity when either side has no coordinates. */
export function swipeDistanceKm(
  geo: { lat: number; lng: number } | null,
  lat: number | null,
  lng: number | null,
): number {
  if (!geo || typeof lat !== "number" || typeof lng !== "number") {
    return Number.POSITIVE_INFINITY;
  }
  return haversineKm(geo.lat, geo.lng, lat, lng);
}

/**
 * Split admitted rows into the bands. Input order is kept inside each band,
 * except `beyond`, which is sorted nearest-first: Proximity is a flat 0 past
 * reach, so it would otherwise come out in whatever order PostgREST returned.
 *
 * NO GEO → EVERYTHING IS NEAR. Every deployed Expo binary and web's shared
 * deck send no coordinates, and there is no radius without a centre.
 * WITH GEO, AN UNLOCATED ROW IS `unplaced`: it cannot prove it is near, and
 * the boxed pool query could never have returned it anyway.
 */
export function partitionSwipeTiers<T>(
  rows: T[],
  opts: SwipeTierOpts<T>,
): SwipeTiers<T> {
  const at = opts.at ?? new Date();
  const reachKm = Math.max(opts.radiusKm, opts.reachKm);
  const tiers: SwipeTiers<T> = {
    strict: [],
    openReach: [],
    closedReach: [],
    beyond: [],
    unplaced: [],
  };
  const distance = new Map<T, number>();
  for (const row of rows) {
    const km = opts.geo
      ? swipeDistanceKm(opts.geo, opts.latOf(row), opts.lngOf(row))
      : 0;
    if (!Number.isFinite(km)) {
      tiers.unplaced.push(row);
      continue;
    }
    distance.set(row, km);
    const open = swipeOpenThrough(
      opts.hoursOf(row),
      opts.lngOf(row),
      opts.bufferMin,
      at,
    );
    if (km <= opts.radiusKm) {
      (open ? tiers.strict : tiers.closedReach).push(row);
    } else if (km <= reachKm) {
      (open ? tiers.openReach : tiers.closedReach).push(row);
    } else {
      tiers.beyond.push(row);
    }
  }
  if (opts.geo) {
    const byDistance = (a: T, b: T) =>
      (distance.get(a) ?? Infinity) - (distance.get(b) ?? Infinity);
    tiers.beyond.sort(byDistance);
  }
  return tiers;
}

/** How many rows the bands hold in total. */
export function swipeTierCount<T>(tiers: SwipeTiers<T>): number {
  return SWIPE_TIER_ORDER.reduce((n, tier) => n + tiers[tier].length, 0);
}

/**
 * Fill the deck band by band, ranking each band ON ITS OWN and concatenating.
 *
 * Ranking per band is the whole invariant: `slotPromoted` moves a promoting
 * place forward over whatever list it is handed, so one ranking over the
 * joined bands would let a promoting closed place buy slot 5 above an open
 * one. Map already slots inside each lane for the same reason
 * (nearby-lineup.ts). A band is only ranked if the deck still has room, so a
 * full strict band costs exactly what Scroll cost before MESITA-2047.
 */
export async function fillSwipeDeck<T>(
  tiers: SwipeTiers<T>,
  limit: number,
  rankTier: (rows: T[], tier: SwipeTier) => T[] | Promise<T[]>,
): Promise<{ deck: T[]; backfilled: number }> {
  const deck: T[] = [];
  let backfilled = 0;
  for (const tier of SWIPE_TIER_ORDER) {
    const room = limit - deck.length;
    if (room <= 0) break;
    if (tiers[tier].length === 0) continue;
    const ranked = (
      SWIPE_DISTANCE_ORDERED.has(tier)
        ? tiers[tier]
        : await rankTier(tiers[tier], tier)
    ).slice(0, room);
    deck.push(...ranked);
    if (tier !== "strict") backfilled += ranked.length;
  }
  return { deck, backfilled };
}

/**
 * How many rows at the head of the band order are FINAL once every place
 * within `searchedKm` has been fetched — rows no place farther out could ever
 * precede. The wider-ask loop stops on this, never on a raw count: counting
 * closed places inside the radius as "the deck is full" skipped the reach ask
 * and served forty shut places over thirty open ones 10 km away (review of
 * MESITA-2047).
 *
 * Every unfetched place is farther than `searchedKm`, which is at least the
 * radius, so it can never be strict. Short of reach it can still land in
 * openReach, above closed-nearby rows — only `strict` is final. From reach on
 * it can only be `beyond`, which is nearest-first, so everything within reach
 * plus the beyond rows already inside `searchedKm` is final. `unplaced` sorts
 * last and can never precede anything, so it never counts.
 */
export function swipeSettledCount<T>(
  tiers: SwipeTiers<T>,
  searchedKm: number,
  reachKm: number,
  distanceOf: (row: T) => number,
): number {
  if (searchedKm < reachKm) return tiers.strict.length;
  return tiers.strict.length + tiers.openReach.length +
    tiers.closedReach.length +
    tiers.beyond.filter((r) => distanceOf(r) <= searchedKm).length;
}

export type WidenSwipePoolOpts<T> = {
  limit: number;
  /** What the radius query already admitted. */
  admitted: T[];
  /** Every id the radius query returned, admitted or not. */
  seen: Set<string>;
  /** The radius the first query searched. */
  radiusKm: number;
  reachKm: number;
  /** Rings to ask, in order. 0 = no box. */
  rings: readonly number[];
  /**
   * One page of the pool at `km` (0 = unboxed), rows `from`..`from+size-1` in
   * a STABLE order. null = the query failed.
   */
  fetchPage: (km: number, from: number, size: number) => Promise<T[] | null>;
  pageSize: number;
  /** Pages per ring before the ring is given up as too big to finish. */
  maxPagesPerRing: number;
  idOf: (row: T) => string;
  /** The hard cuts: type batteries, then the guest's predicates. */
  admit: (rows: T[]) => T[];
  tiersOf: (rows: T[]) => SwipeTiers<T>;
  distanceOf: (row: T) => number;
};

/**
 * Ask wider rings until the band prefix no farther place can enter holds
 * `limit` rows — for a located guest whose radius could not fill the deck.
 * Pure but for `fetchPage`, so the stop rule is testable without a database.
 *
 * A RING COUNTS AS SEARCHED ONLY WHEN IT CAME BACK WHOLE. The stop rule is
 * exact only if every place inside `searchedKm` was fetched; a single capped
 * query (PostgREST cannot order by distance) could return a thousand closed
 * places and miss the open ones behind them, and the rule would call the
 * closed ones final (round-3 review of MESITA-2047). So each ring pages in a
 * stable order until a short page, and a ring still unfinished after
 * `maxPagesPerRing` pages ends the widening where it is — best effort, and
 * every wider ring would be bigger still. A failed page does the same: a
 * thinner deck beats a 502.
 */
export async function widenSwipePool<T>(o: WidenSwipePoolOpts<T>): Promise<T[]> {
  let admitted = o.admitted;
  let searchedKm = o.radiusKm;
  const take = (rows: T[]) => {
    const fresh = rows.filter((r) => !o.seen.has(o.idOf(r)));
    for (const r of fresh) o.seen.add(o.idOf(r));
    admitted = admitted.concat(o.admit(fresh));
  };
  for (const ringKm of o.rings) {
    const settled = swipeSettledCount(
      o.tiersOf(admitted),
      searchedKm,
      o.reachKm,
      o.distanceOf,
    );
    if (settled >= o.limit) break;
    if (ringKm !== 0 && ringKm <= searchedKm) continue;
    let whole = false;
    for (let page = 0; page < o.maxPagesPerRing; page++) {
      const rows = await o.fetchPage(ringKm, page * o.pageSize, o.pageSize);
      if (rows === null) break;
      take(rows);
      if (rows.length < o.pageSize) {
        whole = true;
        break;
      }
    }
    if (!whole) break;
    searchedKm = ringKm === 0 ? Number.POSITIVE_INFINITY : ringKm;
    if (!Number.isFinite(searchedKm)) break;
  }
  return admitted;
}

/**
 * Scroll's exponent vector: the Scroll column, under the Scroll mask.
 *
 * The EF calls THIS, never `weightsForMode` directly — the mode key belongs to
 * one named function per mode so the console's "who reads this column" badge
 * stays checkable, and discovery-swipe.test.ts pins both halves of that.
 */
export function swipeLineupWeights(
  cfg: Pick<DiscoveryConfig, "weights" | "weightsByMode">,
): SignalWeights {
  return weightsForMode("swipe", cfg.weights, cfg.weightsByMode);
}

export type SwipeRankOpts = {
  categories?: string[];
  families?: string[];
  now?: Date;
  random?: () => number;
};

function toSwipeLineupPlace(row: Record<string, unknown>) {
  const place = toLineupPlace(row);
  return { ...place, family_keys: familiesForPlace(place) };
}

/**
 * Places Lineup under the Swipe mask, then the bought slots. Admission must
 * already have run.
 *
 * `slotting` is required, not optional, and that is deliberate: an optional
 * bought lane is how this one sat unwired for three weeks while the console
 * kept storing the knob. A caller that wants merit order says so with
 * `{ enabled: false }`.
 */
export function rankSwipeDeck<T>(
  rows: T[],
  geo: { lat: number; lng: number } | null,
  weights: SignalWeights,
  slotting: SlottingConfig,
  params?: SignalParamsByKey,
  opts?: SwipeRankOpts,
): T[] {
  return discoveryRank(
    rows,
    (row) => toSwipeLineupPlace(row as unknown as Record<string, unknown>),
    (row) => toPromotingFields(row as unknown as Record<string, unknown>),
    {
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      categories: opts?.categories,
      families: opts?.families,
      now: opts?.now,
      random: opts?.random,
    },
    weights,
    slotting,
    params,
  ).map((r) => r.row);
}
