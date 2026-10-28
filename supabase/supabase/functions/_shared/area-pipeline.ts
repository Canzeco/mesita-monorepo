// THE MAP AND CATALOG PIPELINES (Area, MESITA-2302; one pool since
// MESITA-2379; Mesita's places only since MESITA-2872; split in two by
// MESITA-2909). Neither calls Google: Mesita's places are the one source.
//
//   Map (the Search tab)   (point, screen radius)
//     every ready Mesita row in the circle → gates → Popularity × s
//     → the top `map.placesShown`
//   Catalog (Home)         (point or nothing, NO radius)
//     every ready Mesita row → gates → Proximity × Popularity × s
//     → the whole ranked list; the client pages it (`map.catalogPageSize`)
//
// (Pato, MESITA-2909: on the Map distance is a screen, not a sort; the
// Catalog "literal podemos sacar la lista final de todos los lugares en una
// corrida", paged, with Proximity's half distance as its knob.) s is the
// Selected boost / paid Boost factor (area-score.ts). Gates: Family, Radius
// (the Map), the operational ones the read applies (active, ready) and the
// Popularity floor; no reviews floor (MESITA-2721). The two source switches
// (Mesita Popularity / Mesita Proximity, 20 + 20, MESITA-2703) and the
// Distance penalty (MESITA-2720/2776) retired with the split.
//
// Nothing here writes a row.
//
// Chat (MESITA-2339) does not use the pool: `areaSelectedPlaces` reads Mesita
// Selected places only inside `map.radiusKm`, ranked with the Catalog score.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isSelectedRow } from "./selected-row.ts";
import { applyBboxPredicate, type BboxQuery, haversineKm, nearbyBbox } from "./geo.ts";
import { applyGeneralGateQuery, type FilterableQuery } from "./discovery-general-gate.ts";
import { familiesForPlace } from "./place-taxonomy.ts";
import {
  type AreaBounds,
  type AreaCandidate,
  type AreaContext,
  type AreaDiagnostics,
  type AreaLocation,
  type AreaSource,
  insideBounds,
  type LatLng,
  rankArea,
} from "./area-score.ts";
import { PROXIMITY_HALF_KM_DEFAULT } from "./pipeline-signals.ts";
import { type DiscoveryConfig, type SignalParams } from "./discovery-config.ts";

/** Which pipeline runs: the Map (the Search tab) or the Catalog (Home),
 *  MESITA-2909. Chat ranks like the Catalog. */
export type AreaSurface = "map" | "catalog";

/** The numbers a pipeline reads from the blob: Proximity's half distance
 *  (the Catalog only; the Map has none, MESITA-2909), the Popularity floor
 *  and the Selected boost (both pipelines and Chat). Popularity takes no
 *  parameter (MESITA-2710: ln(1 + reviews × stars)). */
export function areaSignalParams(
  params: SignalParams,
  map: {
    popularityFloor?: number;
    selectedFactor?: number;
  },
  surface: AreaSurface,
): Pick<AreaContext, "halfKm" | "popularityFloor" | "selectedFactor"> {
  const h = params.proximity?.halfKm;
  return {
    halfKm: surface === "map"
      ? null
      : typeof h === "number" && Number.isFinite(h) && h > 0 ? h : PROXIMITY_HALF_KM_DEFAULT,
    // The Popularity floor (MESITA-2714), a gate on every caller.
    popularityFloor: map.popularityFloor,
    // The Selected boost (MESITA-2717), a multiplier on every caller.
    selectedFactor: map.selectedFactor,
  };
}

/** A Mesita row in the pool: active and ready. */
export type PoolRow = Record<string, unknown> & {
  id: string;
  lat?: number | null;
  lng?: number | null;
};

const numOrNull = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Mesita Selected (the operator's mark, `places.selected`, MESITA-2707) or
 *  merely a ready Mesita row. Never read off `enriched_at`: Selected and
 *  Enriched are independent facts. */
function mesitaSource(row: Record<string, unknown>): AreaSource {
  return isSelectedRow(row as { selected?: boolean | null }) ? "selected" : "mesita";
}

/** A Mesita row as an Area candidate. */
export function mesitaCandidate(row: Record<string, unknown>): AreaCandidate {
  return {
    id: String(row.id ?? ""),
    lat: numOrNull(row.lat),
    lng: numOrNull(row.lng),
    rating: numOrNull(row.google_stars_overall),
    reviewCount: numOrNull(row.google_review_count),
    familyKeys: familiesForPlace(row),
    source: mesitaSource(row),
    ready: 1,
    reviews: null,
    boostTier: numOrNull(row.boost_tier) ?? 0,
  };
}

// ── Locations ───────────────────────────────────────────────────────────

function latLngOrNull(raw: unknown): LatLng | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const lat = numOrNull(o.lat);
  const lng = numOrNull(o.lng);
  if (lat === null || lng === null) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/** The Map's visible `bounds`, or null when absent or inverted. Any size is
 *  read (Pato, MESITA-2918: "should work doesn't matter how big is the
 *  radius"); the 100 km ceiling that fell back to `map.radiusKm` is gone. */
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
  /** The caller's Mesita read (gates pushed down, `selectedPoolQuery`). */
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
  const km = haversineKm(location.anchor.lat, location.anchor.lng, numOrNull(lat), numOrNull(lng));
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

/** The builder `selectedPoolQuery` needs (supabase-js satisfies it). */
export type SelectedPoolQuery<Q> =
  & FilterableQuery<Q>
  & BboxQuery<Q>
  & {
    not: (col: string, op: string, val: unknown) => Q;
    overlaps: (col: string, val: string[]) => Q;
    order: (col: string, opts?: { ascending?: boolean }) => Q;
  };

/** A supabase-js select, seen structurally: what the EFs hand
 *  `selectedPoolQuery` (the full generic type is too deep to infer). */
export interface PoolBuilder extends SelectedPoolQuery<PoolBuilder> {
  limit: (n: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>;
}

/**
 * The Mesita pool in SQL, with the gates PUSHED DOWN so a dense area does
 * not fill the row cap with rows the ranking would drop: ready, active, the
 * requested families, and the radius box around the point (no centre, no
 * box: the Catalog reads the whole catalog, MESITA-2909). `selectedOnly` (Chat, the default) also keeps only Mesita Selected
 * rows — the operator's mark, `places.selected` (MESITA-2707), never
 * `enriched_at`; the Catalog and the Map pass false, because Selected is a tag
 * on their cards, not their gate.
 */
export function selectedPoolQuery<Q extends SelectedPoolQuery<Q>>(
  query: Q,
  cfg: Pick<DiscoveryConfig, "general">,
  opts: {
    center: LatLng | null;
    radiusKm: number;
    families?: readonly string[];
    selectedOnly?: boolean;
  },
): Q {
  let q: Q = query.eq("content_state", "ready");
  if (opts.selectedOnly !== false) q = q.eq("selected", true);
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

// ── Chat's Selected read (MESITA-2339) ──────────────────────────────────

export type SelectedOpts = {
  /** The anchor, or null (no radius, Popularity alone orders). */
  center: LatLng | null;
  radiusKm: number;
  /** The Family gate's requested families; empty or absent = every family. */
  families?: readonly string[];
  params: SignalParams;
  /** The Popularity floor (MESITA-2714); absent = off. */
  popularityFloor?: number;
  /** The Selected boost (MESITA-2717). Every row here is Selected, so it
   *  scales the scores and never reorders them. */
  selectedFactor?: number;
  limit?: number;
};

/** Mesita Selected rows ranked by the Catalog score, inside the radius. */
export function selectMesitaSelected<T extends Record<string, unknown>>(
  rows: readonly T[],
  opts: SelectedOpts,
): Array<T & { distance_km: number | null }> {
  const location: AreaLocation = opts.center
    ? { kind: "point", anchor: opts.center, radiusKm: opts.radiusKm }
    : { kind: "none" };
  const ranked = rankArea(
    rows.filter((row) => mesitaSource(row) === "selected"),
    mesitaCandidate,
    {
      location,
      families: opts.families ?? [],
      // The Catalog score (MESITA-2909): Proximity with the half distance.
      ...areaSignalParams(opts.params, opts, "catalog"),
    },
  );
  const out = ranked.map(({ item }) => ({
    ...item,
    distance_km: roundedKm(location, item.lat, item.lng),
  }));
  return opts.limit === undefined ? out : out.slice(0, opts.limit);
}

/** What a non-view caller needs of a Selected place, About included. */
const AREA_SELECTED_COLUMNS =
  "id, slug, name, address, lat, lng, family_keys, google_stars_overall, google_review_count, description, enriched_at, content_state, selected, boost_tier";
/** The Selected pool cap for a non-view caller: a few answers, not a map. */
const AREA_SELECTED_POOL = 300;

/**
 * Mesita Selected places for a caller that is not a view — the Chat Agent
 * (MESITA-2339). The same pool query (gates pushed down, Selected only),
 * boxed to `map.radiusKm` around the guest's location when there is one,
 * and the Catalog's score (MESITA-2909). No Google
 * call. Null on error.
 */
export async function areaSelectedPlaces(
  admin: SupabaseClient,
  cfg: Pick<DiscoveryConfig, "general" | "map" | "params">,
  opts: { center: LatLng | null; families: readonly string[]; limit: number },
): Promise<Array<Record<string, unknown> & { distance_km: number | null }> | null> {
  const { data, error } = await selectedPoolQuery(
    admin
      .from("profiles")
      .select(AREA_SELECTED_COLUMNS)
      .eq("state", "active") as unknown as PoolBuilder,
    cfg,
    { center: opts.center, radiusKm: cfg.map.radiusKm, families: opts.families, selectedOnly: true },
  ).limit(AREA_SELECTED_POOL);
  if (error) {
    console.error("[area-pipeline] selected:", error.message);
    return null;
  }
  return selectMesitaSelected((data ?? []) as Record<string, unknown>[], {
    center: opts.center,
    radiusKm: cfg.map.radiusKm,
    families: opts.families,
    params: cfg.params,
    popularityFloor: cfg.map.popularityFloor,
    selectedFactor: cfg.map.selectedFactor,
    limit: opts.limit,
  });
}
