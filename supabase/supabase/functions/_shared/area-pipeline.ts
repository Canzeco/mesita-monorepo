// THE MAP AND CATALOG PIPELINES (Area, MESITA-2302; one pool since
// MESITA-2379; Mesita's places only since MESITA-2872; split in two by
// MESITA-2909). Neither calls Google: Mesita's places are the one source.
//
//   Map (the Search tab)   (point, screen radius)
//     every ready Mesita row in the circle's box (scoring columns, walked by
//     id) → gates → Popularity × s → the top `map.placesShown` BY RANK,
//     then their cards (MESITA-2950)
//   Catalog (Home)         (point or nothing, NO radius)
//     every ready Mesita row (scoring columns, walked by id) → gates →
//     Proximity × Popularity × s → the best 1000 BY RANK, then their cards;
//     the client pages it (`map.catalogPageSize`)
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
import { familiesForPlace } from "./place-taxonomy.ts";
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
import {
  POPULARITY_ROOT_DEFAULT,
  PROXIMITY_EXPONENT_DEFAULT,
  PROXIMITY_HALF_KM_DEFAULT,
} from "./pipeline-signals.ts";
import { type DiscoveryConfig, NO_SCREEN_RADIUS_KM, type SignalParams } from "./discovery-config.ts";
import { chunked, ID_CHUNK } from "./postgrest.ts";
import { finiteOrNull } from "./input.ts";

/** Which pipeline runs: the Map (the Search tab) or the Catalog (Home),
 *  MESITA-2909. Chat ranks like the Catalog. */
export type AreaSurface = "map" | "catalog";

/** The numbers a pipeline reads from the blob: Proximity's half distance
 *  and exponent (the Catalog only; the Map has none, MESITA-2909,
 *  MESITA-3083) and Popularity's root, per surface since MESITA-3086: the
 *  Map reads `map.popularityRoot`, the Catalog and Chat
 *  `params.popularity.root`. No Popularity floor: it moved to the Name
 *  pipeline (MESITA-3086). The Premier factor is the row's own tier, no
 *  knob (MESITA-2925). */
export function areaSignalParams(
  params: SignalParams,
  map: { popularityRoot?: number },
  surface: AreaSurface,
): Pick<AreaContext, "halfKm" | "exponent" | "popularityRoot"> {
  const positive = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
  const h = params.proximity?.halfKm;
  const e = params.proximity?.exponent;
  const root = surface === "map" ? map.popularityRoot : params.popularity?.root;
  return {
    halfKm: surface === "map" ? null : positive(h) ? h : PROXIMITY_HALF_KM_DEFAULT,
    exponent: positive(e) ? e : PROXIMITY_EXPONENT_DEFAULT,
    popularityRoot: positive(root) ? root : POPULARITY_ROOT_DEFAULT,
  };
}

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
};

/** The breakdown a pool place carries (diagnostics only, no card draws it). */
export type AreaPoolDiagnostics = AreaDiagnostics & {
  /** Km from the anchor, 2 decimals; null with no point (MESITA-2830). */
  distanceKm: number | null;
  /** The half distance Proximity read (km); null on the Map (MESITA-2909). */
  halfKm: number | null;
};

export type AreaPoolPlace = Record<string, unknown> & { id: string; area: AreaPoolDiagnostics };

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
};

function roundedKm(location: AreaLocation, lat: unknown, lng: unknown): number | null {
  if (location.kind !== "point") return null;
  const km = haversineKm(location.anchor.lat, location.anchor.lng, finiteOrNull(lat), finiteOrNull(lng));
  return Number.isFinite(km) ? Math.round(km * 10) / 10 : null;
}

/** `map.placesShown` when a caller's cfg predates it. */
const AREA_PLACES_SHOWN_FALLBACK = 50;
/** `map.catalogPageSize` when a caller's cfg predates it. */
const CATALOG_PAGE_SIZE_FALLBACK = 20;

/**
 * The Map or Catalog pool: the caller's Mesita read gated, scored and ranked,
 * every place carrying its `area` breakdown. The Map keeps its top
 * `map.placesShown`; the Catalog keeps every place, best first.
 */
export function selectAreaPool<T extends PoolRow>(
  deps: AreaPoolDeps<T>,
): Promise<{ places: AreaPoolPlace[]; summary: AreaPoolSummary }> {
  const catalog = deps.surface === "catalog";
  const ctx: AreaContext = {
    location: deps.location,
    families: deps.families,
    ...areaSignalParams(deps.cfg.params, deps.cfg.map, deps.surface),
  };
  const ranked = rankArea(
    deps.mesitaRows.map((row) => ({
      candidate: mesitaCandidate(row),
      place: { ...row, distance_km: roundedKm(deps.location, row.lat, row.lng) },
    })),
    (item) => item.candidate,
    ctx,
  );
  const shown = deps.cfg.map.placesShown ?? AREA_PLACES_SHOWN_FALLBACK;
  const kept = catalog ? ranked : ranked.slice(0, Math.max(0, shown));
  const places = kept.map(({ item, area }) => {
    const { distanceKm: km, ...diagnostics } = area;
    // The score tag prints it beside Proximity (MESITA-2830).
    const distanceKm = km === null ? null : Math.round(km * 100) / 100;
    return {
      ...item.place,
      area: { ...diagnostics, distanceKm, halfKm: ctx.halfKm },
    } as AreaPoolPlace;
  });
  const summary: AreaPoolSummary = {
    read: deps.mesitaRows.length,
    ranked: ranked.length,
    returned: places.length,
    surface: deps.surface,
    halfKm: ctx.halfKm,
    placesShown: catalog ? null : shown,
    pageSize: catalog ? catalogPageSize(deps.cfg.map) : null,
  };
  return Promise.resolve({ places, summary });
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

// ── The Catalog's and the Map's read (MESITA-2921, MESITA-2950) ─────────
//
// A capped read ordered by id is an id-ordered slice, and ids are UUIDs: past
// 1000 active places Home ranked an effectively random 1000, not the best,
// and so did the Map once its screen ring (no ceiling, MESITA-2918) held more
// than 1000 ready places. So both read in two passes (the Map boxed to its
// ring, the Catalog unboxed):
//   1. the scoring columns only, walked by id (`.gt("id", last)`) page after
//      page until an EMPTY page, at most CATALOG_SCAN_PAGES_MAX pages;
//   2. ranked with the shared scorer, one page of the ranked list kept (the
//      Catalog's `offset` + page size, MESITA-3044; the Map's top N), and
//      only those cards read, ID_CHUNK ids per `.in()`, in parallel.
// The page stops on an EMPTY page, not a short one: a short page would end
// the walk early if `max_rows` ever dropped below CATALOG_SCAN_PAGE. The
// cost is one extra read. Above the cap the cut is by id again (`scanCapped`,
// MESITA-2921's trigger for a SQL ranking).

/** Pass-1 page size: PostgREST's `max_rows` (config.toml). */
export const CATALOG_SCAN_PAGE = 1000;
/** Pass-1 page cap: 10,000 rows, inside the ~2 s Edge CPU budget. */
export const CATALOG_SCAN_PAGES_MAX = 10;
/** How many ranked places a Catalog request with no `offset` returns (a
 *  build from before MESITA-3044, which paged the whole list itself). */
export const CATALOG_RETURN_MAX = 1000;
/** Everything `mesitaCandidate` reads, and nothing else. */
export const CATALOG_SCORING_COLUMNS =
  "id,lat,lng,google_stars_overall,google_review_count,family_keys,boost_tier";

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
  /** The ranked position this answer starts at (MESITA-3044). */
  offset: number;
  /** The `offset` of the next page, or null when the ranked list ends. */
  next: number | null;
};

type RankedPoolDeps<T extends PoolRow> = {
  read: CatalogRead;
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params">;
  families: readonly string[];
  cardColumns: string;
  /** Shapes pass 2's raw rows (the EF's `wirePlaces`). */
  wire: (rows: unknown[]) => T[];
  pagesMax?: number;
};

type RankedPool = {
  places: AreaPoolPlace[];
  summary: CatalogPoolSummary;
  lastId: string | null;
  /** Every ranked id, best first (MESITA-3057): the Catalog hands Home the
   *  whole order once and Home fills cards by id. Empty on the Map. */
  order: string[];
};

/** Both passes: walk, rank with `selectAreaPool`, keep `keepMax`, read the
 *  kept cards, emit them in rank order. */
async function selectRankedPool<T extends PoolRow>(
  deps: RankedPoolDeps<T>,
  surface: AreaSurface,
  location: AreaLocation,
  gates: CatalogGates,
  keepMax: number,
  offset = 0,
): Promise<RankedPool> {
  const walk = await walkScoringRows(deps.read, deps.cfg, gates, deps.pagesMax);
  const ranked = await selectAreaPool({
    surface,
    location,
    families: deps.families,
    mesitaRows: walk.rows,
    cfg: deps.cfg,
  });
  // One page of the ranked list (MESITA-3044): the whole list is ranked,
  // only this slice's cards are read.
  const end = Math.min(ranked.places.length, offset + keepMax);
  const kept = ranked.places.slice(offset, end);
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
    places.push({ ...card, distance_km: p.distance_km, area: p.area } as AreaPoolPlace);
  }
  return {
    places,
    summary: {
      ...ranked.summary,
      returned: places.length,
      total: ranked.summary.ranked,
      chunks: cards.chunks,
      scanCapped: walk.scanCapped,
      missing: kept.length - places.length,
      offset,
      next: end < ranked.places.length ? end : null,
    },
    lastId: walk.lastId,
    order: surface === "catalog" ? ranked.places.map((p) => p.id) : [],
  };
}

/**
 * The Catalog pool (MESITA-2921): rank every gated place, keep one page,
 * read only its cards. Paged (MESITA-3044, Pato: "sort all catalog places
 * in one run, but don't load them all … load more and more and never stop
 * until the catalog is gone"): `page` asks for `[offset, offset + size)` of
 * the ranked list, and `summary.next` says where the next page starts (null
 * at the end). Edge isolates keep nothing between requests, so each page
 * ranks again; ties break on distance then id, so the order is stable. No
 * `page` = the best CATALOG_RETURN_MAX at once (an older build). Ranking is `selectAreaPool`'s,
 * so the order (`final` desc, then distance, then id) and every `area`
 * breakdown are the scorer's; the card comes from pass 2 and the breakdown
 * from pass 1's values, so a row edited between the two reads can disagree.
 */
export function selectCatalogPool<T extends PoolRow>(
  deps: RankedPoolDeps<T> & { location: AreaLocation; page?: { offset: number; size: number } },
): Promise<RankedPool> {
  return selectRankedPool(
    deps,
    "catalog",
    deps.location,
    { families: deps.families },
    deps.page ? deps.page.size : CATALOG_RETURN_MAX,
    deps.page ? deps.page.offset : 0,
  );
}

/**
 * A Catalog fill (MESITA-3057, Pato: "have all the ids … then populate with
 * data and the images"): the cards for ids Home already holds from a rank
 * answer's `order`, read through the same gates and scored from the same
 * point, so each card carries the rank's `area` and `distance_km`. Rows a
 * gate now closes (inactive, family) drop out;
 * the rest come back in the asked order. No pass 1: nothing is ranked again.
 */
export async function selectCatalogFill<T extends PoolRow>(
  deps: Omit<RankedPoolDeps<T>, "pagesMax"> & { location: AreaLocation; ids: readonly string[] },
): Promise<{ places: AreaPoolPlace[]; summary: { asked: number; returned: number; chunks: number } }> {
  const cards = await cardsForIds(
    deps.read,
    deps.cfg,
    { families: deps.families },
    deps.cardColumns,
    deps.ids,
  );
  // The card columns hold every scoring column, so the scorer reads the
  // cards themselves.
  const scored = await selectAreaPool({
    surface: "catalog",
    location: deps.location,
    families: deps.families,
    mesitaRows: deps.wire(cards.rows),
    cfg: deps.cfg,
  });
  const byId = new Map(scored.places.map((p) => [p.id, p]));
  const places = deps.ids.flatMap((id) => {
    const p = byId.get(id);
    return p ? [p] : [];
  });
  return { places, summary: { asked: deps.ids.length, returned: places.length, chunks: cards.chunks } };
}

/**
 * The Map pool (MESITA-2950): the Catalog's two passes boxed to the screen
 * ring. Every gated place inside the box is ranked (Popularity × s, the
 * Radius gate drops the box's corners), the top `map.placesShown` kept, and
 * only their cards read.
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
};

/** Ready Mesita rows ranked by the Catalog score (Premier factor
 *  included), inside the radius. */
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
      // The Catalog score (MESITA-2909): Proximity with the half distance.
      ...areaSignalParams(opts.params, {}, "catalog"),
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
  "id, slug, name, address, lat, lng, family_keys, google_stars_overall, google_review_count, description, enriched_at, content_state, boost_tier";
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
  return rankMesitaPlaces((data ?? []) as Record<string, unknown>[], {
    center: opts.center,
    radiusKm: NO_SCREEN_RADIUS_KM,
    families: opts.families,
    params: cfg.params,
    limit: opts.limit,
  });
}
