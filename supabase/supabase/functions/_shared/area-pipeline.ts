// THE MAP AND CATALOG PIPELINES (Area, MESITA-2302; one pool since
// MESITA-2379; Mesita's places only since MESITA-2872; split in two by
// MESITA-2909). Neither calls Google: Mesita's places are the one source.
//
//   Map (the Search tab)   (point, screen radius)
//     every ready Mesita row in the circle's box (scoring columns, walked by
//     id) → gates → the Map Organic lane and the Map Inorganic lane (Premier
//     places), merged one ad after every `params.mix.adEvery` organic
//     places → the top `map.placesShown` (ad pins count), then their cards
//     (MESITA-2950); the places after them up to `map.dotsShown` in all come
//     back as bare dots (MESITA-3980)
//   Catalog (Home)         (point or nothing, NO radius)
//     `catalog_rank_lanes` ranks both lanes in SQL for the guest's mode
//     (Nearby · Popular · Family); `mergeLanes` merges them, the first page
//     is shuffled by the mode's Temperature (`cutAndShuffle`), and only that
//     page's cards are read; the client pages the rest by id
//
// DISCOVERY RANKING v2 (MESITA-4454): every score is one formula with a
// recipe row per screen, mode and lane (`recipeFor`, discovery-config.ts):
// Premier boost × (Google popularity × Foursquare boost) × Proximity.
// Google popularity is ((1 − w) × stars × reviews + w × growth)^GoogleExp.
// w is 0 with no usable review history. A missing Foursquare score is 1×.
//
// (Pato, MESITA-2909: on the Map distance is a screen, not a sort; the
// Catalog "literal podemos sacar la lista final de todos los lugares en una
// corrida", paged, with Proximity's half distance as its knob.) s is the
// Premier factor, the paid tier's ×2 · ×5 (area-score.ts). Gates: Family, Radius
// (the Map) and the operational ones the read applies (active, ready); no
// reviews floor (MESITA-2721) and no Popularity floor (Name-only since
// MESITA-3086). The two source switches
// (Mesita Popularity / Mesita Proximity, 20 + 20, MESITA-2703) and the
// Distance penalty (MESITA-2720/2776) retired with the split.
//
// Nothing here writes a row.
//
// Chat (MESITA-2339) does not use the pool: `areaMesitaPlaces` reads every
// ready Mesita place inside `NO_SCREEN_RADIUS_KM`, ranked with the Catalog score
// (Selected only until MESITA-2925).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { applyBboxPredicate, type BboxQuery, haversineKm, nearbyBbox } from "./geo.ts";
import { applyGeneralGateQuery, type FilterableQuery } from "./discovery-general-gate.ts";
import { FAMILIES, familiesForPlace } from "./place-taxonomy.ts";
import { PREMIER_FACTOR } from "./boost.ts";
import {
  type AreaBounds,
  type AreaCandidate,
  type AreaContext,
  type AreaDiagnostics,
  type AreaLocation,
  insideBounds,
  type LatLng,
  rankArea,
} from "./area-score.ts";
import { cutAndShuffle, mergeLanes, type RankMode } from "./pipeline-signals.ts";
import {
  type DiscoveryConfig,
  mixFor,
  NO_SCREEN_RADIUS_KM,
  recipeFor,
  type SignalParams,
} from "./discovery-config.ts";
import { chunked, ID_CHUNK } from "./postgrest.ts";
import { finiteOrNull } from "./input.ts";
import { fetchGrowthTerms, type GrowthTerm } from "./review-growth.ts";

/** Which pipeline runs: the Map (the Search tab) or the Catalog (Home),
 *  MESITA-2909. Chat ranks like the Catalog. */
export type AreaSurface = "map" | "catalog";

/** A Mesita row in the pool: active and ready. */
export type PoolRow = Record<string, unknown> & {
  id: string;
  lat?: number | null;
  lng?: number | null;
};

/** A Mesita row as an Area candidate. */
export function mesitaCandidate(row: Record<string, unknown>): AreaCandidate {
  return {
    id: String(row.id ?? ""),
    lat: finiteOrNull(row.lat),
    lng: finiteOrNull(row.lng),
    rating: finiteOrNull(row.google_stars_overall),
    reviewCount: finiteOrNull(row.google_review_count),
    foursquarePopularity: finiteOrNull(row.foursquare_popularity),
    familyKeys: familiesForPlace(row),
    source: "mesita",
    ready: 1,
    reviews: null,
    premierTier: finiteOrNull(row.boost_tier) ?? 0,
  };
}

// ── Locations ───────────────────────────────────────────────────────────

function latLngOrNull(raw: unknown): LatLng | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lat = finiteOrNull(o.lat);
  const lng = finiteOrNull(o.lng);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** The Map's visible `bounds`, or null when absent or inverted. Any size is
 *  read (Pato, MESITA-2918: "should work doesn't matter how big is the
 *  radius"); the 100 km ceiling that fell back to the operator's radius is gone. */
export function parseAreaBounds(raw: unknown): AreaBounds | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const low = latLngOrNull(o.low);
  const high = latLngOrNull(o.high);
  if (!low || !high) return null;
  if (!(low.lat < high.lat) || !(low.lng < high.lng)) return null;
  return { low, high };
}

/** A centre makes a point; no centre, no location. `radiusKm` gates (the
 *  Map); null does not (the Catalog, MESITA-2909). */
export function resolveAreaLocation(
  center: LatLng | null,
  radiusKm: number | null,
): AreaLocation {
  if (center) return { kind: "point", anchor: center, radiusKm };
  return { kind: "none" };
}

/** The screen radius's floor (km). It has no ceiling (MESITA-2918): the
 *  search is the ring the guest sees, however far out they zoom. */
export const SCREEN_RADIUS_KM_MIN = 0.05;

/** The circle's share of the cross's distance to the nearest edge (Pato,
 *  MESITA-2825: "the edge of the circle must nto be touching the broders,
 *  add border margin"). Mirrored by web-consumer's RING_INSET. */
export const SCREEN_RING_INSET = 0.9;

/**
 * THE SCREEN RADIUS (MESITA-2504): the distance from the cross to the
 * NEAREST edge of the visible map, in km, so the circle always fits on the
 * screen whatever its shape (Pato, MESITA-2511: "the radiopus muse be same
 * size of the smaller radious … horizontal is usually smaller, but not
 * always"). Measured from the cross itself — it sits 45% down, not in the
 * middle — and from the box's middle when the cross is missing or off the
 * box. It was half the width (MESITA-2507), and before that the average of
 * the half-width and half-height. At least SCREEN_RADIUS_KM_MIN, no ceiling
 * (MESITA-2918). Null when the bounds are missing or inverted (the caller
 * falls back to its operator radius). Scaled by
 * SCREEN_RING_INSET first, so the circle stops short of the edge.
 */
export function screenRadiusKm(raw: unknown, cross?: LatLng | null): number | null {
  const b = parseAreaBounds(raw);
  if (!b) return null;
  const inside = cross && insideBounds(cross, b);
  const c = inside ? cross : mid(b.low, b.high);
  const r = Math.min(
    haversineKm(c.lat, c.lng, c.lat, b.low.lng),
    haversineKm(c.lat, c.lng, c.lat, b.high.lng),
    haversineKm(c.lat, c.lng, b.low.lat, c.lng),
    haversineKm(c.lat, c.lng, b.high.lat, c.lng),
  );
  if (!Number.isFinite(r)) return null;
  return Math.max(SCREEN_RADIUS_KM_MIN, r * SCREEN_RING_INSET);
}

function mid(a: LatLng, b: LatLng): LatLng {
  return { lat: (a.lat + b.lat) / 2, lng: (a.lng + b.lng) / 2 };
}

// ── The pool ────────────────────────────────────────────────────────────

export type AreaPoolDeps<T extends PoolRow> = {
  location: AreaLocation;
  /** The Family gate's requested families; empty = every family. */
  families: readonly string[];
  /** The caller's Mesita read (gates pushed down, `mesitaPoolQuery`). */
  mesitaRows: readonly T[];
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params">;
  /** Which pipeline runs (MESITA-2909). Required, so a new caller has to
   *  choose. */
  surface: AreaSurface;
  /** The Catalog's mode (MESITA-4454): which recipe rows score. Absent =
   *  popular. The Map reads its own rows. */
  mode?: RankMode;
  /** A Catalog fill's ad-slot ids (M-c): scored with the mode's Inorganic
   *  row and marked `ad`. */
  adIds?: readonly string[];
  /** Review-growth terms for this rank. Absent: established base only. */
  growth?: ReadonlyMap<string, GrowthTerm>;
};

/** The breakdown a pool place carries (diagnostics only, no card draws it). */
export type AreaPoolDiagnostics = AreaDiagnostics & {
  /** Km from the anchor, 2 decimals; null with no point (MESITA-2830). */
  distanceKm: number | null;
  /** The half distance Proximity read (km); null on the Map (MESITA-2909). */
  halfKm: number | null;
};

/** `ad: true` when the place sits in an ad slot (the Inorganic lane,
 *  MESITA-4454): the only places that wear "Ad". */
export type AreaPoolPlace = Record<string, unknown> & { id: string; area: AreaPoolDiagnostics; ad?: true };

export type AreaPoolSummary = {
  /** Mesita rows the pipeline read, before its gates. */
  read: number;
  /** Rows that passed the gates and were ranked, before any cut. */
  ranked: number;
  returned: number;
  /** Which pipeline ran and the numbers it read (MESITA-2909). */
  surface: AreaSurface;
  halfKm: number | null;
  /** The Map's cut; null on the Catalog, which returns the whole list. */
  placesShown: number | null;
  /** The Catalog's page size; null on the Map. */
  pageSize: number | null;
  /** Places returned in ad slots (MESITA-4454). */
  ads: number;
};

function roundedKm(location: AreaLocation, lat: unknown, lng: unknown): number | null {
  if (location.kind !== "point") return null;
  const km = haversineKm(location.anchor.lat, location.anchor.lng, finiteOrNull(lat), finiteOrNull(lng));
  return Number.isFinite(km) ? Math.round(km * 10) / 10 : null;
}

/** `map.placesShown` when a caller's cfg predates it. */
const AREA_PLACES_SHOWN_FALLBACK = 50;

/** A Map dot (MESITA-3980): a ranked place past `map.placesShown`, up to
 *  `map.dotsShown` in all. Where it is and nothing else: no card is read
 *  for it, so a dot says "zoom in here" and never opens. */
export type MapDot = { id: string; lat: number; lng: number; premier: boolean };

/** The Map's dots out of its ranked list: ranks `shown`..`dotsShown`, and
 *  only the ones with real coordinates. */
function mapDots(
  ranked: ReadonlyArray<{ item: { place: Record<string, unknown> & { id: string } } }>,
  shown: number,
  dotsShown: number | undefined,
): MapDot[] {
  const total = typeof dotsShown === "number" && Number.isFinite(dotsShown) ? dotsShown : 0;
  if (total <= shown) return [];
  const dots: MapDot[] = [];
  for (const { item } of ranked.slice(Math.max(0, shown), total)) {
    const lat = Number(item.place.lat);
    const lng = Number(item.place.lng);
    if (item.place.lat == null || item.place.lng == null) continue;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    // A paid tier paints the dot red, as it does a pin (MESITA-3992).
    const tier = Number(item.place.boost_tier);
    dots.push({ id: String(item.place.id), lat, lng, premier: Number.isFinite(tier) && tier > 0 });
  }
  return dots;
}
/** `map.catalogPageSize` when a caller's cfg predates it. */
const CATALOG_PAGE_SIZE_FALLBACK = 20;

type Lane<T> = {
  item: { candidate: AreaCandidate; place: T & { distance_km: number | null } };
  area: ReturnType<typeof rankArea>[number]["area"];
  ad: boolean;
};

/**
 * The Map or Catalog pool: the caller's Mesita read gated, scored and ranked,
 * every place carrying its `area` breakdown. The Map ranks its Organic and
 * Inorganic (Premier) lanes, merges them (`mergeLanes`, `params.mix.adEvery`)
 * and keeps the top `map.placesShown`, ad pins included; ties by id. The
 * Catalog (a fill, and tests) scores every place with the mode's Organic row,
 * and `adIds` with its Inorganic row, best first.
 */
export function selectAreaPool<T extends PoolRow>(
  deps: AreaPoolDeps<T>,
): Promise<{ places: AreaPoolPlace[]; summary: AreaPoolSummary; dots: MapDot[] }> {
  const catalog = deps.surface === "catalog";
  const mode = catalog ? deps.mode ?? "popular" : "map";
  const organicRecipe = recipeFor(mode, "organic", deps.cfg);
  const adRecipe = recipeFor(mode, "inorganic", deps.cfg);
  const ctx = (recipe: AreaContext["recipe"]): AreaContext => ({
    location: deps.location,
    families: deps.families,
    recipe,
    ties: catalog ? "distance" : "id",
    growth: deps.growth,
    growthWeightCap: mixFor(deps.cfg).growthWeightCap,
  });
  const items = deps.mesitaRows.map((row) => ({
    candidate: mesitaCandidate(row),
    place: { ...row, distance_km: roundedKm(deps.location, row.lat, row.lng) },
  }));
  const organic = rankArea(items, (item) => item.candidate, ctx(organicRecipe));
  let lanes: Lane<T>[];
  if (catalog) {
    const ads = new Set(deps.adIds ?? []);
    const adArea = new Map(
      ads.size === 0 ? [] : rankArea(
        items.filter((i) => ads.has(i.candidate.id)),
        (item) => item.candidate,
        ctx(adRecipe),
      ).map((r) => [r.item.candidate.id, r.area] as const),
    );
    lanes = organic.map((r) => {
      const a = adArea.get(r.item.candidate.id);
      return a ? { item: r.item, area: a, ad: true } : { ...r, ad: false };
    });
  } else {
    // The Map's Inorganic lane: Premier places only; the screen is its cut
    // (no ad floor on the Map).
    const inorganic = rankArea(
      items.filter((i) => i.candidate.premierTier === 1 || i.candidate.premierTier === 2),
      (item) => item.candidate,
      ctx(adRecipe),
    );
    const merged = mergeLanes(
      organic.map((r) => r.item.candidate.id),
      inorganic.map((r) => r.item.candidate.id),
      mixFor(deps.cfg).adEvery,
    );
    const adIds = new Set(merged.adIds);
    const orgById = new Map(organic.map((r) => [r.item.candidate.id, r] as const));
    const adById = new Map(inorganic.map((r) => [r.item.candidate.id, r] as const));
    lanes = merged.order.flatMap((id) => {
      const ad = adIds.has(id);
      const r = ad ? adById.get(id) : orgById.get(id);
      return r ? [{ ...r, ad }] : [];
    });
  }
  const shown = deps.cfg.map.placesShown ?? AREA_PLACES_SHOWN_FALLBACK;
  const kept = catalog ? lanes : lanes.slice(0, Math.max(0, shown));
  const places = kept.map(({ item, area, ad }) => {
    const { distanceKm: km, ...diagnostics } = area;
    // The score tag prints it beside Proximity (MESITA-2830).
    const distanceKm = km === null ? null : Math.round(km * 100) / 100;
    const halfKm = (ad ? adRecipe : organicRecipe).halfKm;
    return {
      ...item.place,
      ...(ad ? { ad: true } : {}),
      area: { ...diagnostics, distanceKm, halfKm },
    } as AreaPoolPlace;
  });
  const summary: AreaPoolSummary = {
    read: deps.mesitaRows.length,
    ranked: organic.length,
    returned: places.length,
    surface: deps.surface,
    halfKm: organicRecipe.halfKm,
    placesShown: catalog ? null : shown,
    pageSize: catalog ? catalogPageSize(deps.cfg.map) : null,
    ads: places.filter((p) => p.ad === true).length,
  };
  const dots = catalog ? [] : mapDots(lanes, shown, deps.cfg.map.dotsShown);
  return Promise.resolve({ places, summary, dots });
}

/** The Catalog's page size: the operator's `map.catalogPageSize`. */
export function catalogPageSize(map: { catalogPageSize?: number }): number {
  const n = map.catalogPageSize;
  return typeof n === "number" && Number.isFinite(n) && n > 0 ? n : CATALOG_PAGE_SIZE_FALLBACK;
}

/** The log line's view of a pool: per-family counts. */
export function areaPoolLogFields(places: readonly AreaPoolPlace[]): {
  families: Record<string, number>;
} {
  const families: Record<string, number> = {};
  for (const p of places) {
    for (const f of p.area.familyKeys) families[f] = (families[f] ?? 0) + 1;
  }
  return { families };
}

// ── The Mesita read ─────────────────────────────────────────────────────

/** The builder `mesitaPoolQuery` needs (supabase-js satisfies it). */
export type MesitaPoolQuery<Q> =
  & FilterableQuery<Q>
  & BboxQuery<Q>
  & {
    not: (col: string, op: string, val: unknown) => Q;
    overlaps: (col: string, val: string[]) => Q;
    order: (col: string, opts?: { ascending?: boolean }) => Q;
  };

/** A supabase-js select, seen structurally: what the EFs hand
 *  `mesitaPoolQuery` (the full generic type is too deep to infer). */
export interface PoolBuilder extends MesitaPoolQuery<PoolBuilder> {
  gt: (col: string, val: unknown) => PoolBuilder;
  in: (col: string, vals: readonly unknown[]) => PoolBuilder;
  limit: (n: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string; code?: string } | null;
  }>;
}

/**
 * The Mesita pool in SQL, with the gates PUSHED DOWN so a dense area does
 * not fill the row cap with rows the ranking would drop: ready, active, the
 * requested families, and the radius box around the point (no centre, no
 * box: the Catalog reads the whole catalog, MESITA-2909). Every caller reads
 * the same rows: the Selected cut Chat had died with MESITA-2925.
 */
export function mesitaPoolQuery<Q extends MesitaPoolQuery<Q>>(
  query: Q,
  cfg: Pick<DiscoveryConfig, "general">,
  opts: {
    center: LatLng | null;
    radiusKm: number;
    families?: readonly string[];
  },
): Q {
  let q: Q = query.eq("content_state", "ready");
  q = applyGeneralGateQuery(q, cfg.general);
  if (opts.families && opts.families.length > 0) {
    q = q.overlaps("family_keys", [...opts.families]);
  }
  if (opts.center) {
    q = applyBboxPredicate(
      q,
      nearbyBbox(opts.center.lat, opts.center.lng, opts.radiusKm),
    );
  }
  // A capped pool must be the same slice every time: without an order,
  // Postgres may hand back any N rows once the area holds more than the cap.
  return q.order("id", { ascending: true });
}

// ── The Map's read (MESITA-2950) and the Catalog's (MESITA-3059) ────────
//
// A capped read ordered by id is an id-ordered slice, and ids are UUIDs: past
// 1000 places in its ring the Map would rank an effectively random 1000. So
// the Map reads in two passes, boxed to its ring:
//   1. the scoring columns only, walked by id (`.gt("id", last)`) page after
//      page until an EMPTY page, at most CATALOG_SCAN_PAGES_MAX pages;
//   2. ranked with the shared scorer, its top N kept, and only those cards
//      read, ID_CHUNK ids per `.in()`, in parallel.
// The page stops on an EMPTY page, not a short one: a short page would end
// the walk early if `max_rows` ever dropped below CATALOG_SCAN_PAGE. Above
// the cap the cut is by id again (`scanCapped`).
//
// The Catalog has no ring, so it does not walk (MESITA-3059): the SQL
// function `catalog_rank` ranks every gated place in one statement and
// answers the ordered ids as one jsonb value (no `max_rows`, no row cap);
// only the first page's cards are read (pass 2) and scored here for their
// `area` breakdown.

/** Pass-1 page size: PostgREST's `max_rows` (config.toml). */
export const CATALOG_SCAN_PAGE = 1000;
/** Pass-1 page cap: 10,000 rows, inside the ~2 s Edge CPU budget. */
export const CATALOG_SCAN_PAGES_MAX = 10;
/** Everything `mesitaCandidate` reads, and nothing else. */
export const CATALOG_SCORING_COLUMNS =
  "id,lat,lng,google_stars_overall,google_review_count,foursquare_popularity,family_keys,boost_tier";

/** A failed Catalog or Map read: which pass and which page or chunk. */
export class CatalogReadError extends Error {
  constructor(
    readonly pass: 1 | 2,
    /** The pass-1 page or the pass-2 chunk, from 0. */
    readonly at: number,
    readonly pgCode: string | null,
    message: string,
  ) {
    super(message);
  }
}

/** A fresh `profiles` select of these columns, `state = active`. */
export type CatalogRead = (columns: string) => PoolBuilder;

/** The gates both passes push down: the families and, on the Map, the
 *  centre's radius box (no centre, no box: the whole catalog). */
type CatalogGates = {
  families: readonly string[];
  center?: LatLng | null;
  radiusKm?: number;
};

const poolOpts = (g: CatalogGates) => ({
  center: g.center ?? null,
  radiusKm: g.radiusKm ?? 0,
  families: g.families,
});

/** Pass 1: every gated row's scoring columns, in id order. */
export async function walkScoringRows(
  read: CatalogRead,
  cfg: Pick<DiscoveryConfig, "general">,
  gates: CatalogGates,
  pagesMax = CATALOG_SCAN_PAGES_MAX,
): Promise<{ rows: PoolRow[]; scanCapped: boolean; lastId: string | null }> {
  const rows: PoolRow[] = [];
  let last: string | null = null;
  for (let page = 0; page < pagesMax; page++) {
    let q = mesitaPoolQuery(read(CATALOG_SCORING_COLUMNS), cfg, poolOpts(gates));
    // The last id from the page Postgres returned, never a re-sorted one.
    if (last !== null) q = q.gt("id", last);
    const { data, error } = await q.limit(CATALOG_SCAN_PAGE);
    if (error) throw new CatalogReadError(1, page, error.code ?? null, error.message);
    const batch = (data ?? []) as PoolRow[];
    if (batch.length === 0) return { rows, scanCapped: false, lastId: last };
    rows.push(...batch);
    last = String(batch[batch.length - 1].id);
  }
  // Every page was full and no empty page was seen.
  return { rows, scanCapped: true, lastId: last };
}

/** Pass 2: the cards for these ids, chunked, in parallel, same gates. */
export async function cardsForIds(
  read: CatalogRead,
  cfg: Pick<DiscoveryConfig, "general">,
  gates: CatalogGates,
  cardColumns: string,
  ids: readonly string[],
): Promise<{ rows: unknown[]; chunks: number }> {
  const parts = chunked([...ids], ID_CHUNK);
  const results = await Promise.all(parts.map(async (chunk, i) => {
    // `limit` is the builder's await point; a chunk never holds more rows.
    const { data, error } = await mesitaPoolQuery(read(cardColumns), cfg, poolOpts(gates))
      .in("id", chunk).limit(chunk.length);
    if (error) throw new CatalogReadError(2, i, error.code ?? null, error.message);
    return data ?? [];
  }));
  return { rows: results.flat(), chunks: parts.length };
}

export type CatalogPoolSummary = AreaPoolSummary & {
  /** Rows that passed the gates and were ranked (`ranked`). `read` is pass
   *  1's rows, `returned` the places emitted after pass 2. */
  total: number;
  /** Pass-2 reads. */
  chunks: number;
  /** `pagesMax` full pages and no empty one: the cut is by id again past
   *  here. */
  scanCapped: boolean;
  /** Kept ids pass 2 did not return (no backfill from below the cut). */
  missing: number;
};

type RankedPoolDeps<T extends PoolRow> = {
  read: CatalogRead;
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params">;
  families: readonly string[];
  cardColumns: string;
  /** Shapes pass 2's raw rows (the EF's `wirePlaces`). */
  wire: (rows: unknown[]) => T[];
  pagesMax?: number;
  /** `discovery_growth_bases`. Absent: the Map scores on the established base. */
  growthBases?: CatalogRankRpc;
};

type RankedPool = {
  places: AreaPoolPlace[];
  summary: CatalogPoolSummary;
  lastId: string | null;
  /** The Map's dots (MESITA-3980); empty on the Catalog. */
  dots: MapDot[];
};

/** Both passes: walk, rank with `selectAreaPool`, keep `keepMax`, read the
 *  kept cards, emit them in rank order. */
async function selectRankedPool<T extends PoolRow>(
  deps: RankedPoolDeps<T>,
  surface: AreaSurface,
  location: AreaLocation,
  gates: CatalogGates,
  keepMax: number,
): Promise<RankedPool> {
  const walk = await walkScoringRows(deps.read, deps.cfg, gates, deps.pagesMax);
  const growth = deps.growthBases
    ? await fetchGrowthTerms(
      deps.growthBases,
      deps.cfg.general.requireActive === true,
      KNOWN_FAMILY_SLUGS,
    )
    : undefined;
  const ranked = await selectAreaPool({
    surface,
    location,
    families: deps.families,
    mesitaRows: walk.rows,
    cfg: deps.cfg,
    growth,
  });
  const kept = ranked.places.slice(0, keepMax);
  const cards = await cardsForIds(
    deps.read,
    deps.cfg,
    gates,
    deps.cardColumns,
    kept.map((p) => p.id),
  );
  const byId = new Map(deps.wire(cards.rows).map((r) => [String(r.id), r]));
  const places: AreaPoolPlace[] = [];
  for (const p of kept) {
    const card = byId.get(p.id);
    if (!card) continue;
    places.push({ ...card, distance_km: p.distance_km, ...(p.ad ? { ad: true } : {}), area: p.area } as AreaPoolPlace);
  }
  return {
    places,
    summary: {
      ...ranked.summary,
      returned: places.length,
      ads: places.filter((p) => p.ad === true).length,
      total: ranked.summary.ranked,
      chunks: cards.chunks,
      scanCapped: walk.scanCapped,
      missing: kept.length - places.length,
    },
    lastId: walk.lastId,
    dots: ranked.dots,
  };
}

/** A SQL rank through supabase-js's `rpc`: `catalog_rank` (`nearest`,
 *  MESITA-3059) or `catalog_rank_lanes` (MESITA-4454). */
export type CatalogRankRpc = (
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>;

/** The family slugs a place must hold one of to pass the Family gate:
 *  every catalog family but Undefined (`knownFamilies`). */
const KNOWN_FAMILY_SLUGS: readonly string[] = FAMILIES
  .map((f) => f.slug as string)
  .filter((s) => s !== "undefined");

function gateArgs(
  cfg: Pick<DiscoveryConfig, "general">,
  location: AreaLocation,
  families: readonly string[],
) {
  const anchor = location.kind === "point" ? location.anchor : null;
  return {
    p_lat: anchor?.lat ?? null,
    p_lng: anchor?.lng ?? null,
    p_premier_1: PREMIER_FACTOR[1],
    p_premier_2: PREMIER_FACTOR[2],
    p_families: [...families],
    p_known_families: [...KNOWN_FAMILY_SLUGS],
    p_require_active: cfg.general.requireActive === true,
  };
}

/** `catalog_rank_lanes`' arguments (MESITA-4454): the mode's two recipe
 *  rows and the ad floor. No repeat penalty since MESITA-4463: the SQL
 *  argument stays (default 1) until MESITA-4457 drops it.
 *  Every number comes from the TypeScript config; SQL owns the arithmetic
 *  only. */
export function catalogRankLanesArgs(
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params">,
  location: AreaLocation,
  families: readonly string[],
  mode: RankMode,
): Record<string, unknown> {
  const org = recipeFor(mode, "organic", cfg);
  const ad = recipeFor(mode, "inorganic", cfg);
  return {
    ...gateArgs(cfg, location, families),
    p_organic_half_km: org.halfKm,
    p_organic_distance_exp: org.distanceExp,
    p_organic_stars_exp: 1, // Legacy RPC signature.
    p_organic_google_exp: org.googleExp,
    p_organic_premier_exp: org.premierExp,
    p_organic_fsq_factor: org.foursquareFactor,
    p_organic_fsq_exp: org.foursquareExponent,
    p_ad_half_km: ad.halfKm,
    p_ad_distance_exp: ad.distanceExp,
    p_ad_stars_exp: 1, // Legacy RPC signature.
    p_ad_google_exp: ad.googleExp,
    p_ad_premier_exp: ad.premierExp,
    p_ad_fsq_factor: ad.foursquareFactor,
    p_ad_fsq_exp: ad.foursquareExponent,
    p_ad_floor: mixFor(cfg).adFloor,
  };
}

/** `catalog_rank`'s arguments for `nearest` (the Reward tab, MESITA-3214):
 *  distance alone, no lanes, no variety, so only the gates matter; the
 *  score numbers are the Nearby Organic row's. */
export function catalogNearestArgs(
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params">,
  location: AreaLocation,
  families: readonly string[],
): Record<string, unknown> {
  const r = recipeFor("nearby", "organic", cfg);
  return {
    ...gateArgs(cfg, location, families),
    p_half_km: r.halfKm,
    p_exponent: r.distanceExp,
    p_root: r.googleExp,
    p_stars_power: 0,
    p_repeat: 1,
    p_nearest: true,
  };
}

export type CatalogRankSummary = AreaPoolSummary & {
  /** Rows that passed the gates and were ranked (`ranked`). `read` is the
   *  rows the SQL rank read before the Family gate, `returned` the places
   *  emitted after pass 2. */
  total: number;
  /** Pass-2 reads. */
  chunks: number;
  /** Kept ids pass 2 did not return (no backfill from below the cut). */
  missing: number;
  /** True when `order` was cut at CATALOG_ORDER_CAP (MESITA-4462). */
  capped: boolean;
};

/** What the two lanes held (MESITA-4454): the log line's numbers. All 0 on
 *  `nearest`. */
export type CatalogLaneStats = {
  /** Places in the Organic lane. */
  organic: number;
  /** Premier places past the ad floor (the Inorganic lane). */
  premier: number;
  /** Premier places under the ad floor, across the whole lane. */
  belowFloor: number;
  /** Premier places past the gates, before the floor. */
  inorganicTotal: number;
  /** Ad-slot places on the first page, after the shuffle. */
  adsFirstPage: number;
};

export type CatalogPool = {
  places: AreaPoolPlace[];
  summary: CatalogRankSummary;
  /** Ranked ids (MESITA-3057), the merged list: the shuffled first page,
   *  then the exact merged tail, at most CATALOG_ORDER_CAP (MESITA-4462).
   *  Home fills cards by id. */
  order: string[];
  /** The ids in ad slots, across the whole `order` (M-6); [] on `nearest`. */
  adIds: string[];
  /** id → its 1-based rank in the merged order before the shuffle, for the
   *  first page's ids (M-c); {} on `nearest`. */
  preShuffle: Record<string, number>;
  lanes: CatalogLaneStats;
};

/** Home follows `order` by id. Past this the answer stops and `summary.capped`
 *  says so (MESITA-4462); the catalog itself is not cut. */
export const CATALOG_ORDER_CAP = 1000;

const ids = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);
const count = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) ? v : 0);

/**
 * The Catalog pool (MESITA-2921, MESITA-3059, MESITA-4454): one SQL rank
 * per request, no row cap. For a mode, `catalog_rank_lanes` answers both
 * lane orders; `mergeLanes` puts one ad after every `params.mix.adEvery`
 * organic places; `cutAndShuffle` redraws the first page by the mode's
 * Temperature with the guest's `seed` (the tail keeps its exact order). Only
 * the first `pageSize` cards are read, scored here from the same point with
 * the mode's rows (ad slots with the Inorganic row). Home fills the rest
 * with `selectCatalogFill`. `nearest` (the Reward tab, MESITA-3214) is
 * `catalog_rank` by distance alone: no lanes, no ads, no shuffle. A failed
 * rank is pass 1, page 0.
 */
export async function selectCatalogPool<T extends PoolRow>(
  deps: Omit<RankedPoolDeps<T>, "pagesMax"> & {
    /** `catalog_rank` (the `nearest` path). */
    rank: CatalogRankRpc;
    /** `catalog_rank_lanes` (every mode). */
    rankLanes: CatalogRankRpc;
    /** `discovery_growth_bases`. Absent: card scores use the established base.
     *  The SQL rank still applies growth once the migration is deployed. */
    growthBases?: CatalogRankRpc;
    location: AreaLocation;
    /** The first page's length: only these cards are read, and the shuffle
     *  pool. */
    pageSize: number;
    nearest?: boolean;
    /** The guest's mode (absent = popular). */
    mode?: RankMode;
    /** The first-page shuffle's seed, uint32. */
    seed: number;
  },
): Promise<CatalogPool> {
  const nearest = deps.nearest === true;
  const mode: RankMode = deps.mode ?? "popular";
  const growth = deps.growthBases
    ? await fetchGrowthTerms(
      deps.growthBases,
      deps.cfg.general.requireActive === true,
      KNOWN_FAMILY_SLUGS,
    )
    : undefined;
  let order: string[];
  let adIds: string[] = [];
  let preShuffle: Record<string, number> = {};
  let read: number;
  let lanes: CatalogLaneStats = { organic: 0, premier: 0, belowFloor: 0, inorganicTotal: 0, adsFirstPage: 0 };
  const page = Math.max(0, deps.pageSize);
  if (nearest) {
    const { data, error } = await deps.rank(catalogNearestArgs(deps.cfg, deps.location, deps.families));
    if (error) throw new CatalogReadError(1, 0, error.code ?? null, error.message);
    const answer = (data ?? {}) as { read?: unknown; ids?: unknown };
    order = ids(answer.ids);
    read = typeof answer.read === "number" ? answer.read : order.length;
  } else {
    const { data, error } = await deps.rankLanes(
      catalogRankLanesArgs(deps.cfg, deps.location, deps.families, mode),
    );
    if (error) throw new CatalogReadError(1, 0, error.code ?? null, error.message);
    const answer = (data ?? {}) as Record<string, unknown>;
    const organic = ids(answer.ids);
    const premier = ids(answer.premier);
    const mix = mixFor(deps.cfg);
    const merged = mergeLanes(organic, premier, mix.adEvery);
    order = cutAndShuffle(merged.order, page, mix.temperature[mode], deps.seed);
    adIds = merged.adIds;
    const rankOf = new Map(merged.order.map((id, i) => [id, i + 1] as const));
    preShuffle = Object.fromEntries(order.slice(0, page).map((id) => [id, rankOf.get(id) ?? 0]));
    read = typeof answer.read === "number" ? answer.read : organic.length;
    const ads = new Set(adIds);
    lanes = {
      organic: organic.length,
      premier: premier.length,
      belowFloor: count(answer.below_floor),
      inorganicTotal: count(answer.inorganic_total),
      adsFirstPage: order.slice(0, page).filter((id) => ads.has(id)).length,
    };
  }
  const ranked = order.length;
  const capped = ranked > CATALOG_ORDER_CAP;
  if (capped) {
    order = order.slice(0, CATALOG_ORDER_CAP);
    const keep = new Set(order);
    adIds = adIds.filter((id) => keep.has(id));
  }
  const kept = order.slice(0, page);
  const filled = await selectCatalogFill({ ...deps, mode, adIds, ids: kept, growth });
  return {
    places: filled.places,
    summary: {
      read,
      ranked,
      returned: filled.places.length,
      surface: "catalog",
      halfKm: recipeFor(mode, "organic", deps.cfg).halfKm,
      placesShown: null,
      pageSize: catalogPageSize(deps.cfg.map),
      ads: filled.places.filter((p) => p.ad === true).length,
      total: ranked,
      capped,
      chunks: filled.summary.chunks,
      missing: kept.length - filled.places.length,
    },
    order,
    adIds,
    preShuffle,
    lanes,
  };
}

/**
 * A Catalog fill (MESITA-3057, Pato: "have all the ids … then populate with
 * data and the images"): the cards for ids Home already holds from a rank
 * answer's `order`, read through the same gates and scored from the same
 * point with the same mode's rows, so each card carries the rank's `area`
 * and `distance_km`; an id in `adIds` is scored with the Inorganic row and
 * marked `ad` (M-c). A fill never adds or removes an ad (M6). Rows a gate
 * now closes (inactive, family) drop out; the rest come back in the asked
 * order. No pass 1: nothing is ranked again.
 */
export async function selectCatalogFill<T extends PoolRow>(
  deps: Omit<RankedPoolDeps<T>, "pagesMax"> & {
    location: AreaLocation;
    ids: readonly string[];
    mode?: RankMode;
    adIds?: readonly string[];
    growth?: ReadonlyMap<string, GrowthTerm>;
  },
): Promise<{ places: AreaPoolPlace[]; summary: { asked: number; returned: number; chunks: number; ads: number } }> {
  const cards = await cardsForIds(
    deps.read,
    deps.cfg,
    { families: deps.families },
    deps.cardColumns,
    deps.ids,
  );
  // The card columns hold every scoring column, so the scorer reads the
  // cards themselves.
  const asked = new Set(deps.ids);
  const scored = await selectAreaPool({
    surface: "catalog",
    location: deps.location,
    families: deps.families,
    mesitaRows: deps.wire(cards.rows),
    cfg: deps.cfg,
    mode: deps.mode,
    adIds: (deps.adIds ?? []).filter((id) => asked.has(id)),
    growth: deps.growth,
  });
  const byId = new Map(scored.places.map((p) => [p.id, p]));
  const places = deps.ids.flatMap((id) => {
    const p = byId.get(id);
    return p ? [p] : [];
  });
  return {
    places,
    summary: {
      asked: deps.ids.length,
      returned: places.length,
      chunks: cards.chunks,
      ads: places.filter((p) => p.ad === true).length,
    },
  };
}

/**
 * The Map pool (MESITA-2950): the Catalog's two passes boxed to the screen
 * ring. Every gated place inside the box is ranked in two lanes and merged
 * (the Radius gate drops the box's corners), the top `map.placesShown` kept
 * (ad pins count), and only their cards read.
 */
export function selectMapPool<T extends PoolRow>(
  deps: RankedPoolDeps<T> & { center: LatLng; radiusKm: number },
): Promise<RankedPool> {
  return selectRankedPool(
    deps,
    "map",
    { kind: "point", anchor: deps.center, radiusKm: deps.radiusKm },
    { families: deps.families, center: deps.center, radiusKm: deps.radiusKm },
    // selectAreaPool already cut to `map.placesShown`.
    Number.POSITIVE_INFINITY,
  );
}

// ── Chat's Mesita read (MESITA-2339) ────────────────────────────────────

export type MesitaOpts = {
  /** The anchor, or null (no radius, Popularity alone orders). */
  center: LatLng | null;
  radiusKm: number;
  /** The Family gate's requested families; empty or absent = every family. */
  families?: readonly string[];
  params: SignalParams;
  limit?: number;
  growth?: ReadonlyMap<string, GrowthTerm>;
};

/** Ready Mesita rows ranked by the Catalog Family Organic row (M-f,
 *  MESITA-4454: no Inorganic lane, no ads, no shuffle), inside the
 *  radius. */
export function rankMesitaPlaces<T extends Record<string, unknown>>(
  rows: readonly T[],
  opts: MesitaOpts,
): Array<T & { distance_km: number | null }> {
  const location: AreaLocation = opts.center
    ? { kind: "point", anchor: opts.center, radiusKm: opts.radiusKm }
    : { kind: "none" };
  const ranked = rankArea(
    rows,
    mesitaCandidate,
    {
      location,
      families: opts.families ?? [],
      // Chat ranks with the Catalog Family Organic row (MESITA-4454).
      recipe: recipeFor("family", "organic", { params: opts.params }),
      growth: opts.growth,
      growthWeightCap: mixFor({ params: opts.params }).growthWeightCap,
    },
  );
  const out = ranked.map(({ item }) => ({
    ...item,
    distance_km: roundedKm(location, item.lat, item.lng),
  }));
  return opts.limit === undefined ? out : out.slice(0, opts.limit);
}

/** What a non-view caller needs of a Mesita place, About included. */
const AREA_MESITA_COLUMNS =
  "id, slug, name, address, lat, lng, family_keys, google_stars_overall, google_review_count, foursquare_popularity, description, enriched_at, content_state, boost_tier";
/** The pool cap for a non-view caller: a few answers, not a map. */
const AREA_MESITA_POOL = 300;

/**
 * Ready Mesita places for a caller that is not a view — the Chat Agent
 * (MESITA-2339). The same pool query (gates pushed down), boxed to
 * `NO_SCREEN_RADIUS_KM` around the guest's location when there is one, and the
 * Catalog's score (MESITA-2909), Premier factor included. Every ready place
 * since MESITA-2925 (Selected only before it). No Google call. Null on error.
 */
export async function areaMesitaPlaces(
  admin: SupabaseClient,
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params">,
  opts: { center: LatLng | null; families: readonly string[]; limit: number },
): Promise<Array<Record<string, unknown> & { distance_km: number | null }> | null> {
  const { data, error } = await mesitaPoolQuery(
    admin
      .from("profiles")
      .select(AREA_MESITA_COLUMNS)
      .eq("state", "active") as unknown as PoolBuilder,
    cfg,
    { center: opts.center, radiusKm: NO_SCREEN_RADIUS_KM, families: opts.families },
  ).limit(AREA_MESITA_POOL);
  if (error) {
    console.error("[area-pipeline] mesita:", error.message);
    return null;
  }
  const growth = await fetchGrowthTerms(
    (args) => admin.rpc("discovery_growth_bases", args),
    cfg.general.requireActive === true,
    KNOWN_FAMILY_SLUGS,
  );
  return rankMesitaPlaces((data ?? []) as Record<string, unknown>[], {
    center: opts.center,
    radiusKm: NO_SCREEN_RADIUS_KM,
    families: opts.families,
    params: cfg.params,
    limit: opts.limit,
    growth,
  });
}
