// Supabase Edge Function — consumer-web-list-places
//
// The Map view of the Area pipeline: web Search's pins. Public endpoint:
// returns places visible to consumers (state 'active'). Self-contained: no
// calls to other functions.
//
// TWO CLIENTS, ON PURPOSE (MESITA-1276). The PLACES query stays on the ANON
// client because RLS is the single source of truth for what a consumer may
// see, and routing it through service-role would quietly move that decision
// out of the database. The CONFIG read uses an admin client because
// `app_config` is EF-only locked down — anon cannot read it, and
// `loadDiscoveryConfig` swallows read errors and returns defaults, so an anon
// read here would look like it worked while enforcing nothing. A config that
// silently falls back is not enforced, which is the house definition of a bug.
//
// ONE REQUEST SHAPE — POST { google: true, lat, lng, bounds, familyKeys }:
// web Search, THE MAP PIPELINE (Area, MESITA-2302; split from the Catalog by
// MESITA-2909; `_shared/area-pipeline.ts`). THE MAP IS WHAT THE GUEST SEES
// (MESITA-2499): `bounds` is the visible map, so the zoom decides how wide
// the set is — a street close, a city wide. THE SCREEN RADIUS (MESITA-2504):
// the location is a POINT at the cross (`lat`, `lng`, the sight) inside R =
// the cross's distance to the nearest edge of the visible map
// (`screenRadiusKm`, MESITA-2511: the circle always fits on screen). R is a
// GATE and only a gate (Pato, MESITA-2909: distance "como screening dentro
// del radio, pero no la metería ya para el sorting"): Mesita's read is boxed
// to it, the Radius gate drops what lies past it, and the places inside are
// ranked by Popularity × the Premier factor (a Premier place's paid tier,
// ×2 · ×5 · ×10, MESITA-2925), no Proximity. EVERY ready place in the box is
// ranked (MESITA-2950): the read walks the scoring columns by id, page after
// page (`selectMapPool`, the Catalog's two passes from MESITA-2921), then
// reads only the kept places' cards, so a wide ring never ranks an
// id-ordered 1000-row slice.
// The Map shows the top `map.placesShown`. The family chip gates; the guest
// picks no mode, so `prefer` is ignored. R has no ceiling (MESITA-2918):
// however far out the guest zooms, the search is the ring they see. No
// bounds falls back to the centre inside `map.radiusKm`. The
// answer carries R and each place's breakdown for the debug readout
// (MESITA-2504). Mesita's places only (Google Nearby retired in
// MESITA-2872), the operator's Popularity floor on every place. A stale
// `placesScope` is ignored.
//
// Anything else is refused: a GET is 405, a POST without `google: true` or
// without a lat/lng pair is 400. A failed read is a 502 with
// `code: "places_read_failed"`, the pass, page or chunk and a requestId; the
// PostgREST message is logged, never sent. The listed `{ lat, lng }` lane and the
// GET / `{ limit }` newest-first lane retired with their last callers, and
// `discovery_config.filters` with them (MESITA-2337).
//
// Local:  supabase functions serve consumer-web-list-places
// Deploy: supabase functions deploy consumer-web-list-places

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  clampIntRange,
  corsPreflight,
  json,
  readJsonOr,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  anonClient,
  readAnonEnv,
  readEFEnv,
} from "../_shared/auth.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { withFamilyKeysList } from "../_shared/place-family-keys.ts";
import { readGuestFamilyKeys } from "../_shared/place-taxonomy.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { DISCOVERY_DEFAULTS } from "../_shared/discovery-config.ts";
import { decideNearby, wantsGoogleFill } from "../_shared/geo.ts";
import {
  CatalogReadError,
  type PoolBuilder,
  type PoolRow,
  screenRadiusKm,
  selectMapPool,
} from "../_shared/area-pipeline.ts";
import {
  stripInternal,
  type PlaceProfileRow,
} from "../_shared/place-pool-shape.ts";

const MAX_LIMIT = 200;

/** Same wire shaping as consumer-web-list-catalog (MESITA-2736, MESITA-2740). */
function wireMapPlace(row: PlaceProfileRow): PoolRow {
  const out = stripInternal(row);
  return {
    ...out,
    id: row.id,
    photos: Array.isArray(out.photos) ? out.photos : [],
  } as PoolRow;
}

type ListBody = {
  limit?: number;
  nearby?: boolean;
  google?: boolean;
  /** Ignored since MESITA-2379: the guest never picks a source. */
  placesScope?: unknown;
  /** Ignored (the pre-2026-09-05 ordinal of the same). */
  searchPower?: number;
  familyKeys?: unknown;
  /** Ignored since MESITA-2417; no reviews minimum since MESITA-2721. */
  minReviews?: unknown;
  lat?: number;
  lng?: number;
  radiusKm?: number;
  /** The visible map, `{ low, high }` (MESITA-2499). */
  bounds?: unknown;
  /** Ignored since MESITA-2499: the mode is the server's. */
  prefer?: unknown;
};

/** One place's score, for the debug readout (MESITA-2504): `score`, not
 *  `area` — the Feed's `area` is the whole breakdown. */
type WireScore = {
  proximity: number | null;
  popularity: number | null;
  final: number;
  /** The factor `final` carries: the Premier factor, ×2 · ×5 · ×10, else 1
   *  (MESITA-2925; the key predates Premier). */
  selectedFactor: number;
  /** Km from the cross (MESITA-2830); it screens, never scores. */
  distanceKm: number | null;
};

type CardRow = {
  id: string;
  google_place_id?: string | null;
  name?: string | null;
  google_name?: string | null;
  category?: string | null;
  content_state?: string | null;
  enriched_at?: string | null;
  lat?: number | null;
  lng?: number | null;
  distance_km?: number | null;
  google_stars_overall?: number | null;
  google_review_count?: number | null;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readAnonEnv();
  if (!envRes.ok) return envRes.response;

  // Anon client is sufficient: the places RLS policy already restricts SELECT
  // to listed rows (state 'active') for anon + authenticated. This is the
  // single source of truth for what consumers are allowed to see.
  const supabase = anonClient(envRes.env);

  const body = await readJsonOr<ListBody>(req, {});
  const nearbyDecision = decideNearby(body as Record<string, unknown>);
  if (nearbyDecision.mode === "invalid") {
    return json({
      ok: false,
      error: "nearby needs finite lat and lng",
      code: "invalid_nearby",
    }, 400);
  }
  // `google: true` is web Search's marker (it once meant "can render a
  // Google-only stub"; no stub comes back since MESITA-2872). It is the only
  // caller left, so a call without it, or without a centre,
  // has nothing to answer (MESITA-2337).
  if (
    nearbyDecision.mode !== "ok" ||
    !wantsGoogleFill(body as Record<string, unknown>)
  ) {
    return json({
      ok: false,
      error: "list-places answers web Search only: POST { google: true, lat, lng }",
      code: "web_search_only",
    }, 400);
  }
  const guestSupers = readGuestFamilyKeys(body.familyKeys);

  const efEnv = readEFEnv();
  const cfg = efEnv.ok
    ? await loadDiscoveryConfig(adminClient(efEnv.env))
    : DISCOVERY_DEFAULTS;
  const center = { lat: nearbyDecision.lat, lng: nearbyDecision.lng };
  // The screen radius, or the operator's when there is no screen to read.
  const screenKm = screenRadiusKm(body.bounds, center);
  const radiusKm = screenKm ?? cfg.map.radiusKm;
  const requestId = crypto.randomUUID();
  // Popularity × the Premier factor; the radius only gates (MESITA-2909).
  // Every ready place in the box is ranked, then the kept cards are read
  // (MESITA-2950).
  let area: Awaited<ReturnType<typeof selectMapPool<PoolRow>>>;
  try {
    area = await selectMapPool<PoolRow>({
      read: (columns) => supabase.from("profiles").select(columns) as unknown as PoolBuilder,
      cfg,
      center,
      radiusKm,
      families: guestSupers,
      cardColumns: PLACE_CARD_COLUMNS,
      wire: (rows) => rows as PoolRow[],
    });
  } catch (err) {
    if (!(err instanceof CatalogReadError)) throw err;
    const at = err.pass === 1 ? { page: err.at } : { chunk: err.at };
    console.error(JSON.stringify({
      fn: "consumer-web-list-places",
      event: "read_failed",
      requestId,
      pass: err.pass,
      ...at,
      pgCode: err.pgCode,
      message: err.message,
    }));
    return json({
      ok: false,
      code: "places_read_failed",
      error: "Places read failed",
      pass: err.pass,
      ...at,
      requestId,
    }, 502);
  }
  // A caller that names its own cap keeps it.
  const places = typeof body.limit === "number"
    ? area.places.slice(0, clampIntRange(body.limit, 1, MAX_LIMIT))
    : area.places;
  // One line, because every failure mode is a WRONG SET rather than an
  // error: `scanCapped` means the box held more than the walk reads, and
  // past it the cut is by id again.
  console.log(JSON.stringify({
    fn: "consumer-web-list-places",
    requestId,
    radius: screenKm === null ? "operator" : "screen",
    radiusKm,
    ...area.summary,
    lastId: area.summary.scanCapped ? area.lastId : undefined,
    returned: places.length,
  }));
  return json({
    ok: true,
    places: withFamilyKeysList(
      places.map(({ area: a, ...p }) => {
        const wired = wireMapPlace(p as PlaceProfileRow);
        return {
          ...wired,
          score: {
            proximity: a.signals.proximity,
            popularity: a.signals.popularity,
            final: a.final,
            selectedFactor: a.selectedFactor,
            distanceKm: a.distanceKm,
          } satisfies WireScore,
        };
      }) as CardRow[],
    ),
    radiusKm,
    // The Map's reload throttle (MESITA-2444) plus min screen move (MESITA-2732);
    // the dead km/sec pair is not sent.
    reloadIdleSec: cfg.map.reloadIdleSec,
    reloadMinViewportPct: cfg.map.reloadMinViewportPct,
  });
});
