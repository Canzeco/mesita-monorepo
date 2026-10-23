// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// The Feed: the Catalog VIEW of the Area pipeline (MESITA-2302, one pool
// since MESITA-2379, four sources since MESITA-2703,
// `_shared/area-pipeline.ts`). One round trip: `selectAreaPool` pulls the
// four sources the operator switched on (Google Popular, Google Closest —
// one billed Nearby call each — Mesita Popular, Mesita Closest) around the
// point inside the radius, merges duplicates and ranks the pool. The client
// pages it, so a later page never re-pays Google.
//
// THE RADIUS: the saved pin's own `radiusKm` when the client sends one, else
// the operator's `map.radiusKm` (the device's current location). Mesita's
// read and Google's circle use it; it gates and sets Proximity's half distance. ONE RANKING,
// THE MAP'S: Proximity^a × Popularity^b × the Selected factor
// (`map.proximityWeight`, `map.popularityWeight`, `map.selectedFactor` on a
// Selected place, MESITA-2717; Proximity ½ at the radius ÷ the operator's
// radius divisor, read by the engine, MESITA-2720). `prefer` is ignored; a family
// row only gates, ranked the same way.
//
// A FAMILY ROW ASKS ITS OWN QUESTION (MESITA-2438): `familyKeys` sends
// Google that family's full type battery (`areaGoogleTypes`), pushes the
// Family gate into the Mesita read, and lists the family's PRIMARY places
// before its secondary ones. Without it the pool is every family's.
//
// Request: POST { unified: true, google: true, lat, lng, radiusKm?, familyKeys? }
//   radiusKm  the saved pin's radius, clamped to 1..50; missing or not a
//             number = `map.radiusKm` (log `radius: "operator"`).
//   lat/lng   a POINT; none = no location (Mesita Popular only,
//             Popularity alone). Home never asks for an area: saved
//             areas (Territory) were retired 2026-10-20 (MESITA-2500), so a
//             `bounds` an old build still sends is ignored and logged as
//             `bounds_ignored`; drop that log once it stays quiet.
//   google    the client can render a Google-only stub; the operator's two
//             Google switches, a key and the per-IP ledger also decide.
//   The Google reviews minimum is the operator's `map.googleMinReviews`
//   alone (MESITA-2417), on Google hits; never a Mesita floor.
// Response (unified): { ok, location: { kind, radiusKm, operatorRadiusKm },
//   places: [... { area }],
//   summary }. QUOTA: one load spends up to 2 of the per-IP 45 Nearby calls
//   a minute (one per Google switch on); a partly refused pair logs
//   `quota: "partial"`.
//
// LEGACY (no `unified`): the old rails — Google Places, Mesita Selected,
// then one rail per family — cut from the same ranked four-source pool, at
// most `catalog.railCap` per rail, so a consumer build from before
// MESITA-2384 keeps working while Vercel and the EFs deploy apart. Removed
// by a follow-up once the new build is live.
//
// Local:  supabase functions serve consumer-web-list-catalog
// Deploy: supabase functions deploy consumer-web-list-catalog

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceProfileRow } from "../_shared/place-pool-shape.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { loadDiscoveryConfig } from "../_shared/discovery-config.ts";
import { buildCatalogRails } from "../_shared/catalog-rank.ts";
import { decideNearby, wantsGoogleFill } from "../_shared/geo.ts";
import {
  mapShouldFillGoogle,
} from "../_shared/map-engine.ts";
import { readGooglePlacesKey } from "../_shared/google-places.ts";
import {
  areaPoolLogFields,
  areaGoogleTypes,
  areaWeights,
  type OwnedRow,
  type PoolBuilder,
  requestRadiusKm,
  resolveAreaLocation,
  selectAreaPool,
  selectedPoolQuery,
} from "../_shared/area-pipeline.ts";
import { readGuestFamilyKeys } from "../_shared/place-taxonomy.ts";
import { areaQuota, ownedLookup } from "../_shared/area-deps.ts";

const POOL_CAP = 1000;

type Body = {
  lat?: number;
  lng?: number;
  /** The saved pin's radius (MESITA-2703); absent = `map.radiusKm`. */
  radiusKm?: unknown;
  /** Sent by builds from before MESITA-2500; ignored, only logged. */
  bounds?: unknown;
  /** The client can render a Google-only stub. */
  google?: boolean;
  /** Ignored since MESITA-2417: `map.googleMinReviews` is the minimum. */
  minReviews?: unknown;
  /** The one-pool wire (MESITA-2379); absent = the legacy rails. */
  unified?: boolean;
  /** Ignored since MESITA-2516: one ranking, the Map's. */
  prefer?: unknown;
  /** The family row's families (MESITA-2438); absent or empty = every family. */
  familyKeys?: unknown;
};

function wirePlaces(rows: unknown[]): OwnedRow[] {
  return (rows as PlaceProfileRow[]).map((r) => {
    const out = stripInternal(r);
    return {
      ...out,
      id: r.id,
      photos: Array.isArray(out.photos) ? out.photos : [],
    } as OwnedRow;
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const body = await readJsonOr<Body>(req, {});
  const unified = body.unified === true;
  const admin = adminClient(env);
  const cfg = await loadDiscoveryConfig(admin);
  const nearby = decideNearby(body as Record<string, unknown>);
  const center = nearby.mode === "ok" ? { lat: nearby.lat, lng: nearby.lng } : null;
  // Validated before it reaches the Mesita box or Google's circle.
  const radius = requestRadiusKm(body.radiusKm, cfg.map.radiusKm);
  const radiusKm = radius.km;
  // Home ranks from a point or nothing (MESITA-2500): saved areas are gone.
  if (body.bounds !== undefined && body.bounds !== null) {
    console.log(JSON.stringify({ fn: "consumer-web-list-catalog", event: "bounds_ignored" }));
  }
  const location = resolveAreaLocation(center, radiusKm);
  // The legacy rails cut every family from one pool; only the one-pool wire
  // may ask for a family.
  const families = unified ? readGuestFamilyKeys(body.familyKeys).filter((f) => f !== "undefined") : [];

  // Card columns only: no Area signal reads the summary vector, so the pool
  // does not select it (MESITA-2328).
  const { data, error } = await selectedPoolQuery(
    admin
      .from("profiles")
      .select(PLACE_CARD_COLUMNS)
      .eq("state", "active") as unknown as PoolBuilder,
    cfg,
    {
      center: location.kind === "point" ? location.anchor : null,
      radiusKm,
      families,
      selectedOnly: false,
    },
  ).limit(POOL_CAP);

  if (error) {
    console.error("[list-catalog] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }
  const mesitaRows = wirePlaces(data ?? []);

  const weights = areaWeights(cfg.map);
  const googleOn = location.kind !== "none" &&
    mapShouldFillGoogle(wantsGoogleFill(body as Record<string, unknown>), cfg.map);
  const gmp = googleOn ? readGooglePlacesKey() : null;
  const pool = await selectAreaPool<OwnedRow>({
    apiKey: gmp?.ok ? gmp.key : null,
    location,
    families,
    types: googleOn ? areaGoogleTypes(families) : [],
    mesitaRows,
    cfg,
    consumeQuota: areaQuota(req, admin, env.serviceKey),
    lookupOwned: ownedLookup(admin, PLACE_CARD_COLUMNS, "list-catalog", wirePlaces),
  });

  // One line, because every failure mode here is a WRONG SET rather than an
  // error: Google switched off, a spent quota and a skewed client all look
  // like a thin catalog from the outside.
  console.log(JSON.stringify({
    fn: "consumer-web-list-catalog",
    wire: unified ? "unified" : "legacy",
    location: location.kind,
    radius: radius.from,
    radiusKm,
    proximityWeight: weights.proximity,
    popularityWeight: weights.popularity,
    familyKeys: families,
    ...pool.summary,
    mesitaRead: mesitaRows.length,
    mesitaCapped: mesitaRows.length >= POOL_CAP,
    ...areaPoolLogFields(pool.places),
  }));

  if (unified) {
    return json({
      ok: true,
      // The radius searched and the operator's current-location radius
      // (MESITA-2703): the client names both in the location sheet.
      location: { kind: location.kind, radiusKm, operatorRadiusKm: cfg.map.radiusKm },
      places: pool.places,
      summary: pool.summary,
    });
  }

  const rails = buildCatalogRails(
    pool.places.filter((p) => p.area.source !== "selected"),
    pool.places.filter((p) => p.area.source === "selected"),
    cfg.catalog.railCap,
  );
  return json({
    ok: true,
    rails,
    summary: {
      pool: data?.length ?? 0,
      lists: rails.length,
      google: pool.summary.google,
    },
  });
});
