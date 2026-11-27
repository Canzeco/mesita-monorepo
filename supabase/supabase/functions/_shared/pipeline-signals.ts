// The Discovery signals (MESITA-2327): continuous scores, defined once and
// reused by the pipelines that name them. name_similarity left with the
// Mesita name vector (MESITA-2896/2900): Google's name is canonical.
//
//   description_similarity  Description · the Deep pipeline
//   proximity               Proximity · the Catalog pipeline (and Chat)
//                           1 ÷ (1 + (d ÷ D)^e), MESITA-3015, MESITA-3083
//   popularity              Popularity · the Map and Catalog pipelines
//                           (1 + reviews × stars)^root, MESITA-3083
//   recipeScore             Discovery ranking v2 (MESITA-4454): the Map,
//                           Catalog and Chat score, one recipe row per
//                           screen, mode and lane; `mergeLanes` and
//                           `cutAndShuffle` build Home's order
//
// A signal scores; it never excludes (that is a gate's job, area-score.ts).
// Each one states its own missing-data policy here, beside the formula, so a
// pipeline cannot quietly give a gap a meaning. Nothing in this file calls a
// network: a query vector arrives already embedded, and only a pipeline that
// uses a vector signal ever asks for one (lazy evaluation).

import { cosineSim, parseVector } from "./embeddings-vector.ts";
import { haversineKm } from "./geo.ts";
import {
  blendPopularity,
  establishedBase,
  GROWTH_CAP_DEFAULT,
  type GrowthTerm,
} from "./review-growth.ts";

const clamp01 = (n: number) => (n <= 0 ? 0 : n >= 1 ? 1 : n);

// ── Proximity ─────────────────────────────────────────────────────────────

/** THE HALF DISTANCE D (km, MESITA-3015): the Catalog pipeline's Proximity
 *  is ½ at D, whatever the exponent. The operator's `params.proximity.halfKm`,
 *  0.1–100 km, live 1 km (Pato, 2026-10-29: "e 1 and h as 1 too"). Read it
 *  as the radius of "here", the distance that changes no decision: about
 *  half a kilometre on foot, two or three by car. */
export const PROXIMITY_HALF_KM_DEFAULT = 1;
export const PROXIMITY_HALF_KM_MIN = 0.1;
export const PROXIMITY_HALF_KM_MAX = 100;

/** THE DISTANCE EXPONENT e (MESITA-3083): the operator's
 *  `params.proximity.exponent`, 0.5–5 at one decimal (MESITA-4451), live 1. At 1 the
 *  curve is the plain reciprocal: past D the credit is D ÷ d, twice as far
 *  is half, and with Popularity's cube root the three factors speak one
 *  language (8× the reviews = a ×2 plan = twice as close). Under 1 the far
 *  keeps its credit (a city-wide fame list); over 1 the curve is flat
 *  inside D and a cliff past it (the far is gone, however great). MESITA-3015
 *  had ruled "never an exponent knob"; Pato reversed it to keep every
 *  hyperparameter functional. */
export const PROXIMITY_EXPONENT_DEFAULT = 1;
export const PROXIMITY_EXPONENT_MIN = 0.5;
export const PROXIMITY_EXPONENT_MAX = 5;

/**
 * proximity(d) = 1 ÷ (1 + (d ÷ D)^e), D the half distance, e the exponent
 * (MESITA-3015, MESITA-3083): 1 at the point, ½ at D whatever e is, never
 * 0. At e = 1: ⅓ at 2D, and past D only distance RATIOS order places, twice
 * as far is half the credit at any scale, so a place wins from twice as far
 * with 8× the reviews (Popularity's cube root) or a ×2 plan, and from five
 * times as far with 125× the reviews or a ×5 plan. Another city (100× the
 * distance) never tops Home; a walking city and a car city rank alike, D
 * being the only city-shaped number. It replaced the log curve
 * 1 ÷ (1 + ln(1 + (e − 1) · d ÷ h)) (MESITA-2909), which kept a famous
 * place 36 km away above an average one 5 km away. Only the Catalog
 * pipeline (Home) and Chat read it; the Map ranks by Popularity alone and
 * uses distance only as its screen (MESITA-2909). A distance that is not a
 * number cannot be placed, so it scores 0; so does any distance past the
 * point when D is not positive. An exponent that is not a positive number
 * reads the default.
 */
export function proximityFromDistance(
  distanceKm: number,
  halfKm: number,
  exponent: number = PROXIMITY_EXPONENT_DEFAULT,
): number {
  if (Number.isNaN(distanceKm) || distanceKm === Infinity) return 0;
  if (distanceKm <= 0) return 1;
  if (!(Number.isFinite(halfKm) && halfKm > 0)) return 0;
  const e = Number.isFinite(exponent) && exponent > 0 ? exponent : PROXIMITY_EXPONENT_DEFAULT;
  return clamp01(1 / (1 + Math.pow(distanceKm / halfKm, e)));
}

/**
 * Missing data: no anchor (a guest who shared no location) → 1 for every
 * place, the signal abstains instead of inventing a centre. A place with no
 * coordinates → 0: it cannot be placed relative to the anchor at all.
 */
export function proximity(
  candidate: { lat?: number | null; lng?: number | null },
  anchor: { lat: number; lng: number } | null,
  halfKm: number,
  exponent: number = PROXIMITY_EXPONENT_DEFAULT,
): number {
  if (!anchor) return 1;
  if (typeof candidate.lat !== "number" || typeof candidate.lng !== "number") return 0;
  const km = haversineKm(anchor.lat, anchor.lng, candidate.lat, candidate.lng);
  return Number.isFinite(km) ? proximityFromDistance(km, halfKm, exponent) : 0;
}

// ── Popularity ────────────────────────────────────────────────────────────

/** THE POPULARITY ROOT (MESITA-3083): the operator's
 *  `params.popularity.root`, 0.1–1 at two decimals, live 0.33, the cube
 *  root (Pato, 2026-10-29: "POPULARITY IS GOING TO BE CUBIC ROOT"; "the
 *  hyperparameter is which root"). At the cube root every 8× the reviews
 *  doubles the factor and every 1,000× is 10×, so the Premier tiers read
 *  as reviews: ×2 = 8× the reviews, ×5 = 125×. A bigger root makes reviews
 *  count more against a plan; a smaller one less. */
export const POPULARITY_ROOT_DEFAULT = 0.33;
export const POPULARITY_ROOT_MIN = 0.1;
export const POPULARITY_ROOT_MAX = 1;

/** THE STARS WEIGHT k (MESITA-4153): the operator's
 *  `params.popularity.starsPower`, 0–12 at one decimal, default 6. The
 *  Catalog's and Chat's Popularity is multiplied by (stars ÷ 5)^k, so the
 *  best places rise (Pato, 2026-11-16: "finding the best places even if
 *  those are a bit far"): at 6, 4.9★ beats 4.4★ ×1.9 and 4.0★ ×3.4. Under
 *  the root alone 4.0★ vs 4.9★ was ×1.07. 0 = no stars weight. The Map
 *  never reads it. */
export const STARS_POWER_DEFAULT = 6;
export const STARS_POWER_MIN = 0;
export const STARS_POWER_MAX = 12;

// The repeat penalty (`params.variety.repeat`, MESITA-4153) is gone
// (MESITA-4463, Pato: "remove the variety in the backend too"): no list
// lowers the n-th place of a kind any more.

/** THE TEMPERATURE T (MESITA-4153): the operator's
 *  `params.shuffle.temperature`, 0–5 at two decimals, default 0.3. After
 *  the sort Home's order is drawn again, each place weighted
 *  1 ÷ rank^(1/T) (`shuffleByRank`). 0 = the sort exactly; 0.3 = neighbours
 *  swap; 1 = loose; 3+ = nearly random. */
export const SHUFFLE_TEMPERATURE_DEFAULT = 0.3;
export const SHUFFLE_TEMPERATURE_MIN = 0;
export const SHUFFLE_TEMPERATURE_MAX = 5;

/**
 * THE MAP AND CATALOG SCORES' POPULARITY: (1 + reviews × stars)^root
 * (MESITA-3083; ln(1 + reviews × stars) from MESITA-2710 until then, whose
 * spread was 1.8× at most, so a ×2 plan beat any popularity gap). Unbounded,
 * never normalized (Pato, MESITA-2710: "popularity can be above 1, it must
 * not be normalized"): at the cube root 4.6★ × 1,000 reviews ≈ 16.2, 4.0★ ×
 * 30 ≈ 4.9. The 1 + keeps a place with no reviews at 1 (a factor, never
 * 0 or −∞): it ranks by distance and plan alone. No rating or no review
 * count → 0. A root that is not a positive number reads the default.
 */
export function rootPopularity(
  candidate: { rating?: number | null; reviewCount?: number | null },
  root: number = POPULARITY_ROOT_DEFAULT,
  /** The stars weight k (MESITA-4153): × (stars ÷ 5)^k; 0 or absent = none. */
  starsPower = 0,
): number {
  const r = candidate.rating;
  const n = candidate.reviewCount;
  if (typeof r !== "number" || typeof n !== "number") return 0;
  if (!Number.isFinite(r) || !Number.isFinite(n)) return 0;
  const a = Number.isFinite(root) && root > 0 ? root : POPULARITY_ROOT_DEFAULT;
  const k = Number.isFinite(starsPower) && starsPower > 0 ? starsPower : 0;
  const stars = k > 0 ? Math.pow(Math.max(0, r) / 5, k) : 1;
  return Math.pow(1 + Math.max(0, n) * Math.max(0, r), a) * stars;
}

/**
 * THE SHUFFLE AFTER THE SORT (MESITA-4153, Pato: "after all the sorting is
 * done, pass that to a certain random sorting algorithm that you can
 * control with a temperature"). Plackett–Luce on rank, by the Gumbel trick:
 * the place at rank i (from 1) keys on −ln(i) ÷ T plus a Gumbel draw, and
 * the list sorts by key. That is drawing without replacement with weight
 * 1 ÷ i^(1/T). T ≤ 0 returns the order as it is. Never reads a score, so
 * the sort alone decides who is near the top.
 */
export function shuffleByRank<T>(
  order: readonly T[],
  temperature: number,
  random: () => number = Math.random,
): T[] {
  if (!(Number.isFinite(temperature) && temperature > 0) || order.length < 2) return [...order];
  const gumbel = () => {
    const u = Math.min(1 - 1e-12, Math.max(1e-12, random()));
    return -Math.log(-Math.log(u));
  };
  return order
    .map((item, i) => ({ item, key: -Math.log(i + 1) / temperature + gumbel() }))
    .sort((a, b) => b.key - a.key)
    .map((x) => x.item);
}

// ── Discovery ranking v2 (MESITA-4454): one formula, two lanes, three modes ──
//
//   Score     = Premier boost × Popularity × Proximity
//   Popularity = Google popularity × Foursquare boost
//   Google popularity = ((1 − w) × stars × reviews + w × growthBase) ^ GoogleExp
//   Foursquare boost = 1 + factor × raw ^ exponent   (missing or 0 raw → 1×)
//   Proximity = 1 ÷ (1 + (distance ÷ HalfDistance) ^ DistanceExp)   (Map: none)
//   premierFactor = 1 · 2 · 5 (no plan · 2X · 5X); premierBoost = premierFactor ^ PremierExp
//   w = 0 with no usable review history, so a cold place is (stars × reviews) ^ GoogleExp
//
// Every number is a recipe row (`params.recipes`, discovery-config.ts); the
// SQL copy is `catalog_rank_lanes` (pinned by catalog_rank_lanes.test.sql on
// the same hand values as pipeline-signals.test.ts).

/** Recipe bounds (DX-a, Names: never "root"). Half distance and Distance
 *  exponent are Proximity's own (above). */
export const GOOGLE_EXP_MIN = 0.1;
export const GOOGLE_EXP_MAX = 1;
export const PREMIER_EXP_MIN = 0;
export const PREMIER_EXP_MAX = 2;
/** Foursquare boost: 1 + factor × raw^exponent. Factor 0 turns the boost off. */
export const FOURSQUARE_FACTOR_MIN = 0;
export const FOURSQUARE_FACTOR_MAX = 5;
export const FOURSQUARE_EXPONENT_MIN = 1;
export const FOURSQUARE_EXPONENT_MAX = 40;
export const FOURSQUARE_FACTOR_DEFAULT = 1;
export const FOURSQUARE_EXPONENT_DEFAULT = 20;
/** The mix: per-mode Temperature (the shuffle's), the ad floor and cadence. */
export const MIX_TEMPERATURE_MIN = 0;
export const MIX_TEMPERATURE_MAX = 5;
export const AD_FLOOR_MIN = 0;
export const AD_FLOOR_MAX = 1;
export const AD_EVERY_MIN = 0;
export const AD_EVERY_MAX = 10;
/** Pro and Max factors (MESITA-5028): the multiplier each paid plan earns;
 *  1 = no lift over a free place. Defaults 2 and 5 (PREMIER_FACTOR). */
export const PLAN_FACTOR_MIN = 1;
export const PLAN_FACTOR_MAX = 10;
/** Growth's share of Popularity once a place has 30 days of review history. */
export const GROWTH_WEIGHT_CAP_MIN = 0;
export const GROWTH_WEIGHT_CAP_MAX = 0.8;

/** One recipe row. `halfKm` and `distanceExp` are null on the Map's rows
 *  (no Proximity there); `premierExp` is 0 on every Organic row. */
export type Recipe = {
  halfKm: number | null;
  distanceExp: number | null;
  googleExp: number;
  /** Coefficient on the Foursquare term. 0 disables the boost. 1 allows up to 2×. */
  foursquareFactor: number;
  /** Applied to raw Foursquare popularity (0–1) before the factor. */
  foursquareExponent: number;
  premierExp: number;
  /** A Catalog lane's batch (MESITA-4517): how many places it gives each
   *  weave. Null on the Map's rows; absent on a caller's literal = 10. */
  batch?: number | null;
};

/**
 * Popularity: (blend) ^ GoogleExp. With no growth term the blend is
 * stars × reviews, so a cold place matches the linear-stars formula exactly.
 * Unbounded, never normalized. 0 reviews, no stars, or no review count → 0
 * (MESITA-4454; the old `1 +` kept it at 1).
 */
export function googlePopularity(
  candidate: { rating?: number | null; reviewCount?: number | null },
  googleExp: number,
  term?: GrowthTerm,
  cap: number = GROWTH_CAP_DEFAULT,
): number {
  const base = blendPopularity(establishedBase(candidate.rating, candidate.reviewCount), term, cap);
  if (!(base > 0)) return 0;
  const g = Number.isFinite(googleExp) && googleExp > 0 ? googleExp : 1;
  return Math.pow(base, g);
}

/**
 * 1 + factor × raw^exponent. A missing score, a measured 0, or factor 0 is
 * exactly 1×. Raw is Foursquare's 0–1 popularity; values outside that clip.
 * The exponent must be positive.
 */
export function foursquareBoost(
  raw: number | null | undefined,
  factor: number,
  exponent: number,
): number {
  const f = Number.isFinite(factor) ? factor : FOURSQUARE_FACTOR_DEFAULT;
  if (!(f > 0)) return 1;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw <= 0) return 1;
  const e = Number.isFinite(exponent) && exponent > 0 ? exponent : FOURSQUARE_EXPONENT_DEFAULT;
  const clipped = Math.min(1, Math.max(0, raw));
  return 1 + f * Math.pow(clipped, e);
}

/** premierFactor ^ PremierExp: 1 whenever the exponent is 0. */
export function premierBoost(premierFactor: number, premierExp: number): number {
  const f = Number.isFinite(premierFactor) && premierFactor > 0 ? premierFactor : 1;
  const e = Number.isFinite(premierExp) && premierExp > 0 ? premierExp : 0;
  return Math.pow(f, e);
}

/** One place's v2 score and its parts. `proximity` is null when the recipe
 *  has no Proximity (a Map row) or there is no anchor to measure from — it
 *  then counts as 1 (abstains). */
export type RecipeScore = {
  proximity: number | null;
  popularity: number;
  premierFactor: number;
  premierBoost: number;
  final: number;
};

/**
 * THE v2 SCORE (MESITA-4454) for a candidate at `distanceKm` (null = no
 * anchor, or no coordinates when `placed` is false). A Map row (null
 * `halfKm`) has no Proximity. A place with no coordinates, measured from an
 * anchor, has Proximity 0.
 */
export function recipeScore(
  candidate: { rating?: number | null; reviewCount?: number | null; foursquarePopularity?: number | null },
  distanceKm: number | null,
  hasAnchor: boolean,
  premierFactor: number,
  recipe: Recipe,
  growth?: { term?: GrowthTerm; cap?: number },
): RecipeScore {
  const google = googlePopularity(candidate, recipe.googleExp, growth?.term, growth?.cap);
  const popularity = google * foursquareBoost(
    candidate.foursquarePopularity,
    recipe.foursquareFactor ?? FOURSQUARE_FACTOR_DEFAULT,
    recipe.foursquareExponent ?? FOURSQUARE_EXPONENT_DEFAULT,
  );
  const boost = premierBoost(premierFactor, recipe.premierExp);
  let prox: number | null = null;
  if (recipe.halfKm !== null && hasAnchor) {
    prox = distanceKm === null
      ? 0
      : proximityFromDistance(distanceKm, recipe.halfKm, recipe.distanceExp ?? PROXIMITY_EXPONENT_DEFAULT);
  }
  return {
    proximity: prox,
    popularity,
    premierFactor,
    premierBoost: boost,
    final: (prox ?? 1) * popularity * boost,
  };
}

/** The ad floor (MESITA-4454, M5): an Inorganic place takes an ad slot only
 *  when Proximity (its lane's row; 1 with no anchor) × the raw
 *  premierFactor (2 or 5) reaches it. */
export function clearsAdFloor(proximityOrNull: number | null, premierFactor: number, adFloor: number): boolean {
  return (proximityOrNull ?? 1) * premierFactor >= adFloor;
}

// ── The merge and the shuffle (MESITA-4454) ─────────────────────────────────

/**
 * THE MERGE (M-g): `adEvery` organic places, then one ad slot, again and
 * again. A place already shown is skipped and its slot takes the next place
 * of its lane; an ad slot with no Premier place left is dropped and the
 * organic list continues; a place appears once. `adEvery` 0 = no ad slots.
 * `adIds` are the ids sitting in ad slots (the only ones that wear "Ad").
 */
export function mergeLanes(
  organic: readonly string[],
  premier: readonly string[],
  adEvery: number,
): { order: string[]; adIds: string[] } {
  const every = Number.isFinite(adEvery) ? Math.floor(adEvery) : 0;
  const seen = new Set<string>();
  const order: string[] = [];
  const adIds: string[] = [];
  let p = 0;
  const nextAd = (): string | null => {
    while (p < premier.length) {
      const id = premier[p++];
      if (!seen.has(id)) return id;
    }
    return null;
  };
  let sinceAd = 0;
  for (const id of organic) {
    if (seen.has(id)) continue;
    seen.add(id);
    order.push(id);
    sinceAd++;
    if (every > 0 && sinceAd >= every) {
      sinceAd = 0;
      const ad = nextAd();
      if (ad !== null) {
        seen.add(ad);
        order.push(ad);
        adIds.push(ad);
      }
    }
  }
  return { order, adIds };
}

/** One organic lane of a feed (MESITA-4517): its ranked ids and how many
 *  places it gives each weave. `key` names the lane (a recipe row). */
export type WeaveLane = { key: string; ids: readonly string[]; batch: number };

/**
 * THE WEAVE (MESITA-4517, MESITA-4548): a feed is its lanes' batches, round
 * after round. Each round takes the next `batch` unseen ids of every organic
 * lane, in lane order (an earlier lane claims a shared place first), and
 * interleaves them one from each lane. Then ad slots go in: one after every
 * `adEvery` organic places, drawn round-robin from the feed's Inorganic
 * lanes, each giving at most its batch per round. A place appears once.
 * Rounds repeat until no organic lane has an unseen id left. `weaves` holds
 * each round's length: the first is Home's first screen and the shuffle's
 * pool. `laneOf` names the lane every id took.
 */
export function weaveLanes(
  organic: readonly WeaveLane[],
  inorganic: WeaveLane | readonly WeaveLane[] | null,
  adEvery: number,
): { order: string[]; adIds: string[]; laneOf: Record<string, string>; weaves: number[] } {
  const every = Number.isFinite(adEvery) ? Math.floor(adEvery) : 0;
  const ads = inorganic === null ? [] : Array.isArray(inorganic) ? inorganic : [inorganic as WeaveLane];
  const seen = new Set<string>();
  const order: string[] = [];
  const adIds: string[] = [];
  const laneOf: Record<string, string> = {};
  const weaves: number[] = [];
  const at = organic.map(() => 0);
  const adAt = ads.map(() => 0);
  let nextAdLane = 0;
  const batchOf = (n: number) => (Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1);
  for (;;) {
    // Each lane's next batch, claimed in lane order.
    const batches = organic.map((lane, li) => {
      const out: string[] = [];
      const want = batchOf(lane.batch);
      while (out.length < want && at[li] < lane.ids.length) {
        const id = lane.ids[at[li]++];
        if (seen.has(id)) continue;
        seen.add(id);
        laneOf[id] = lane.key;
        out.push(id);
      }
      return out;
    });
    const chunk: string[] = [];
    for (let i = 0; batches.some((b) => i < b.length); i++) {
      for (const b of batches) if (i < b.length) chunk.push(b[i]);
    }
    if (chunk.length === 0) break;
    const start = order.length;
    const quota = ads.map((l) => batchOf(l.batch));
    // The next unseen Premier id, round-robin over lanes with quota left.
    const nextAd = (): string | null => {
      for (let tries = 0; tries < ads.length; tries++) {
        const li = (nextAdLane + tries) % ads.length;
        if (quota[li] <= 0) continue;
        while (adAt[li] < ads[li].ids.length) {
          const id = ads[li].ids[adAt[li]++];
          if (seen.has(id)) continue;
          seen.add(id);
          laneOf[id] = ads[li].key;
          quota[li]--;
          nextAdLane = (li + 1) % ads.length;
          return id;
        }
      }
      return null;
    };
    let sinceAd = 0;
    for (const id of chunk) {
      order.push(id);
      sinceAd++;
      if (ads.length > 0 && every > 0 && sinceAd >= every) {
        sinceAd = 0;
        const ad = nextAd();
        if (ad !== null) {
          order.push(ad);
          adIds.push(ad);
        }
      }
    }
    weaves.push(order.length - start);
  }
  return { order, adIds, laneOf, weaves };
}

/**
 * BOTH, the Local Favorites Lane (MESITA-4517; every feed since
 * MESITA-4548): the places in the better half of the close ranking AND the
 * better half of the well-known ranking (index < n ÷ 2 in each), nearest
 * first: the close ranking's order and nothing else (MESITA-4674).
 */
export function strongOnBoth(close: readonly string[], wellKnown: readonly string[]): string[] {
  const rw = new Map(wellKnown.map((id, i) => [id, i] as const));
  return close.filter((id, c) => {
    const w = rw.get(id);
    return w !== undefined && c * 2 < close.length && w * 2 < wellKnown.length;
  });
}

/** A keyed uniform in (0, 1) from (seed, id): FNV-1a over the id, mixed
 *  with the seed, then a murmur3 finalizer. Same seed and id → same draw,
 *  whatever else is in the list (M-b). */
export function keyedUniform(seed: number, id: string): number {
  let h = (0x811c9dc5 ^ (seed >>> 0)) >>> 0;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  h ^= seed >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35) >>> 0;
  h ^= h >>> 16;
  return ((h >>> 0) + 0.5) / 4294967296;
}

/**
 * THE FIRST-PAGE SHUFFLE (MESITA-4454): the first `pageSize` ids are drawn
 * again with weight 1 ÷ rank^(1/T) (Plackett–Luce by the Gumbel trick, as
 * `shuffleByRank`), the noise keyed by hash(seed, id) so a place keeps its
 * draw when another enters the page (M-b). Everything after the first page
 * keeps its exact order. T ≤ 0 is the identity. Every seed is valid, 0
 * included.
 */
export function cutAndShuffle(
  order: readonly string[],
  pageSize: number,
  temperature: number,
  seed: number,
): string[] {
  const n = Math.max(0, Math.floor(Number.isFinite(pageSize) ? pageSize : 0));
  if (!(Number.isFinite(temperature) && temperature > 0) || n < 2 || order.length < 2) return [...order];
  const head = order.slice(0, n);
  const tail = order.slice(n);
  const shuffled = head
    .map((id, i) => {
      const u = keyedUniform(seed, id);
      return { id, key: -Math.log(i + 1) / temperature - Math.log(-Math.log(u)) };
    })
    .sort((a, b) => b.key - a.key || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((x) => x.id);
  return [...shuffled, ...tail];
}

/** The three questions Home asks (Names: Nearby · Popular · Family). */
export const RANK_MODES = ["nearby", "popular", "family"] as const;
export type RankMode = (typeof RANK_MODES)[number];

export function isRankMode(v: unknown): v is RankMode {
  return typeof v === "string" && (RANK_MODES as readonly string[]).includes(v);
}

/** A Home chip's key → its mode (DX-c): `near` → nearby, `all` → popular,
 *  any family key → family. Stored chip keys are never renamed. */
export function rankModeForChip(key: string): RankMode {
  if (key === "near") return "nearby";
  if (key === "all") return "popular";
  return "family";
}

/** True when the place's Popularity is at or over the operator's floor
 *  (`name.popularityFloor`, MESITA-2714; `map.popularityFloor` until
 *  MESITA-3086; in the root's own units since MESITA-3083: 2.7 ≈ reviews ×
 *  stars of 19); a floor of 0 or less is off. Read only by the guest
 *  Search bar's order (MESITA-2724): Home, the Map and Chat hide nothing
 *  for Popularity since MESITA-3086. */
export function clearsPopularityFloor(
  candidate: { rating?: number | null; reviewCount?: number | null },
  floor: number,
  root: number = POPULARITY_ROOT_DEFAULT,
): boolean {
  if (!(floor > 0)) return true;
  return rootPopularity(candidate, root) >= floor;
}

/** The 0..1 Popularity below now feeds only the stored `map.minPopularity`
 *  floor (live 0, no box edits it); the Map and Catalog read `rootPopularity`.
 *  Its half point K is a constant since MESITA-3083: the
 *  `params.popularity.halfReviews` knob was stored, mirrored and read by
 *  nothing, so it was retired. */
export const POPULARITY_HALF_REVIEWS_DEFAULT = 100;

/**
 * popularity = (rating ÷ 5) × reviews ÷ (reviews + halfReviews)
 * (MESITA-2347). Rating counts linearly — a 3★ place is 60% of a 5★ one
 * at any volume — and volume saturates: ½ credit at `halfReviews`, never 1.
 * 0..1 by construction. Missing data: no rating or no review count → 0,
 * and there is deliberately no new-place prior; under the Area score's
 * weighted sum that demotes the place, it never deletes it.
 */
export function popularity(
  candidate: { rating?: number | null; reviewCount?: number | null },
  halfReviews: number,
): number {
  const r = candidate.rating;
  const n = candidate.reviewCount;
  if (typeof r !== "number" || typeof n !== "number") return 0;
  if (!Number.isFinite(r) || !Number.isFinite(n)) return 0;
  const k = Number.isFinite(halfReviews) && halfReviews > 0
    ? halfReviews
    : POPULARITY_HALF_REVIEWS_DEFAULT;
  const rating = clamp01(Math.max(0, r) / 5);
  const count = Math.max(0, n);
  return clamp01(rating * (count / (count + k)));
}

// ── Description ───────────────────────────────────────────────────────────

/**
 * description_similarity: the query's meaning against the place's
 * precomputed summary embedding. Lazy by construction: it takes a vector a
 * pipeline has already chosen to compute, so the Map and Catalog (which do not use it)
 * never triggers an embedding call. Missing data: no candidate vector →
 * null, "cannot judge"; the Deep pipeline leaves such a place out rather
 * than ranking it as a mismatch.
 */
export function descriptionSimilarity(
  queryVector: number[],
  embedding: unknown,
): number | null {
  const v = parseVector(embedding);
  if (!v || v.length !== queryVector.length) return null;
  const cos = cosineSim(queryVector, v);
  return Number.isFinite(cos) ? clamp01(cos) : null;
}
