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
// web Search, the Map view of the AREA PIPELINE (MESITA-2302, MESITA-2327,
// one pool since MESITA-2379, `_shared/area-pipeline.ts`). THE MAP IS WHAT
// THE GUEST SEES (MESITA-2499): `bounds` is the visible map, so the zoom
// decides how wide the set is — a street close, a city wide. THE SCREEN
// RADIUS (MESITA-2504): the location is a POINT at the cross (`lat`, `lng`,
// the sight) inside R = the cross's distance to the nearest edge of the
// visible map (`screenRadiusKm`, MESITA-2511: the circle always fits on
// screen). R is a GATE on both sources — Mesita's
// read is boxed to it and the Radius gate drops what lies past it, Google's
// calls ask the prominent 20 inside it first and eligibility drops the rest
// (Pato: "I son't want to see stuff beyond my screen"). The score is
// Proximity^a × Popularity^1 × Selected^1 with Proximity's reach = R (1 at
// the cross, 0 at the edge, the same at every zoom); `a` is the operator's
// `map.proximityWeight`, the one exponent that moves. The family chip gates;
// the guest picks no mode, so `prefer` is ignored. No bounds, or a box wider
// than AREA_BOUNDS_MAX_KM, falls back to the centre inside `map.radiusKm`,
// scored the same way. The answer carries R, the weights and each place's
// breakdown for the debug readout (MESITA-2504). It
// shows the same merged pool as the Feed — Google and Mesita candidates
// deduped, gated, scored, × Selected, ranked — with its own budget: the
// operator's `map.mapGooglePlaces` (20 · 40 · 60 = 1 / 2 / 3 Nearby calls
// per load, MESITA-2687; the reload throttle bounds the spend), the guest's
// family pills pushed down to Nearby types, the operator's
// `map.googleMinReviews` on Google hits, and `map.mesitaPlaces` Mesita
// candidates. The guest never picks a source: a stale `placesScope` is
// ignored.
//
// Anything else is refused: a GET is 405, a POST without `google: true` or
// without a lat/lng pair is 400. The listed `{ lat, lng }` lane and the
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
import {
  enabledNearbyTypes,
  mapShouldFillGoogle,
} from "../_shared/map-engine.ts";
import {
  decideNearby,
  NEARBY_SCAN_LIMIT,
  wantsGoogleFill,
} from "../_shared/geo.ts";
import {
  areaGoogleTypes,
  areaWeights,
  googleCallsForStop,
  type OwnedRow,
  type PoolBuilder,
  screenRadiusKm,
  selectAreaPool,
  selectedPoolQuery,
} from "../_shared/area-pipeline.ts";
import { areaQuota, ownedLookup } from "../_shared/area-deps.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";

const MAX_LIMIT = 200;

type ListBody = {
  limit?: number;
  nearby?: boolean;
  google?: boolean;
  /** Ignored since MESITA-2379: the guest never picks a source. */
  placesScope?: unknown;
  /** Ignored (the pre-2026-09-05 ordinal of the same). */
  searchPower?: number;
  familyKeys?: unknown;
  /** Ignored since MESITA-2417: the Google reviews minimum is the
   *  operator's, `map.googleMinReviews`. */
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
  selected: number;
  final: number;
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
  // `google: true` is web Search saying it can render a Google-only stub.
  // It is the only caller left, so a call without it, or without a centre,
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
  // A GUEST PILL OUTRANKS THE FULL BATTERY, deliberately (MESITA-1685). The
  // pill IS the guest's question. With no pill, Nearby asks for every guest
  // family. Stored family switches are not read. The operator still holds
  // googleFill, the floors, and the rate controls.
  const nearbyTypes = guestSupers.length > 0
    ? areaGoogleTypes(guestSupers)
    : enabledNearbyTypes(cfg.map);
  const googleFill = mapShouldFillGoogle(true, cfg.map) &&
    nearbyTypes.length > 0;
  const center = { lat: nearbyDecision.lat, lng: nearbyDecision.lng };
  // The screen radius, or the operator's when there is no screen to read.
  const screenKm = screenRadiusKm(body.bounds, center);
  const radiusKm = screenKm ?? cfg.map.radiusKm;
  const location = { kind: "point" as const, anchor: center, radiusKm };
  // Proximity^a × Popularity^1 × Selected^1, reach = the radius.
  const weights = areaWeights(cfg.map);
  const pool = await selectedPoolQuery(
    supabase.from("profiles").select(PLACE_CARD_COLUMNS) as unknown as PoolBuilder,
    cfg,
    { center, radiusKm, families: guestSupers, selectedOnly: false },
  ).limit(NEARBY_SCAN_LIMIT);
  if (pool.error) {
    return json({ ok: false, error: pool.error.message }, 500);
  }
  const gmp = googleFill ? readGooglePlacesKey() : null;
  const area = await selectAreaPool<OwnedRow>({
    apiKey: gmp?.ok && efEnv.ok ? gmp.key : null,
    location,
    families: guestSupers,
    types: googleFill ? nearbyTypes : [],
    // The operator's Map stop: 20 · 40 · 60 = 1 / 2 / 3 calls (MESITA-2687).
    googleCalls: googleFill ? googleCallsForStop(cfg.map.mapGooglePlaces) : 0,
    mesitaLimit: cfg.map.mesitaPlaces,
    mesitaRows: (pool.data ?? []) as OwnedRow[],
    cfg,
    consumeQuota: efEnv.ok
      ? areaQuota(req, adminClient(efEnv.env), efEnv.env.serviceKey)
      : () => Promise.resolve(false),
    // ONE lookup by google_place_id, ready rows only (RLS limits it to
    // listed rows): a hit a ready Mesita row owns goes out as that row,
    // never a stub (MESITA-2154). An owned row that is not ready stays a
    // stub, and its tap's get-or-create opens the Mesita place.
    lookupOwned: ownedLookup(supabase, PLACE_CARD_COLUMNS, "consumer-web-list-places"),
    signals: { reachKm: radiusKm, weights },
    // The prominent 20 inside the whole radius first, whatever the chip.
    fanoutMode: "popular",
  });
  // A caller that names its own cap keeps it.
  const places = typeof body.limit === "number"
    ? area.places.slice(0, clampIntRange(body.limit, 1, MAX_LIMIT))
    : area.places;
  // One line, because every failure mode is a WRONG SET rather than an
  // error: Google switched off and a spent quota look like a thin map.
  console.log(JSON.stringify({
    fn: "consumer-web-list-places",
    mode: "nearby",
    radius: screenKm === null ? "operator" : "screen",
    radiusKm,
    proximityWeight: weights.proximity,
    googleFillOn: googleFill,
    ...area.summary,
    returned: places.length,
  }));
  return json({
    ok: true,
    places: withFamilyKeysList(
      places.map(({ area: a, ...p }) => ({
        ...p,
        score: {
          proximity: a.signals.proximity,
          popularity: a.signals.popularity,
          selected: a.selected,
          final: a.final,
        } satisfies WireScore,
      })) as CardRow[],
    ),
    mode: "nearby",
    radiusKm,
    weights,
    // The Map's reload throttle (MESITA-2444); the dead km/sec pair is not sent.
    reloadIdleSec: cfg.map.reloadIdleSec,
  });
});
