// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// The Feed: the Catalog VIEW of the Area pipeline (MESITA-2302, one pool
// since MESITA-2379, Mesita's two sources only since MESITA-2872,
// `_shared/area-pipeline.ts`). One round trip: `selectAreaPool` pulls the
// sources the operator switched on (Mesita Popularity, Mesita Proximity)
// around the point inside the radius, merges duplicates and ranks the pool.
// The client pages it. Nothing here calls Google (Nearby retired,
// MESITA-2872).
//
// THE RADIUS: the saved pin's own `radiusKm` when the client sends one, else
// the operator's `map.radiusKm` (the device's current location). Mesita's
// read uses it; it gates and sets Proximity's half distance. ONE RANKING,
// THE MAP'S: Proximity × Popularity × the Selected boost
// (`map.selectedFactor` on a Selected place, MESITA-2717; no exponents
// since MESITA-2722; Proximity ½ at the radius ÷ the operator's
// radius divisor, read by the engine, MESITA-2720). `prefer` is ignored; a family
// row only gates, ranked the same way.
//
// A FAMILY ROW ASKS ITS OWN QUESTION (MESITA-2438): `familyKeys` pushes the
// Family gate into the Mesita read. Without it the pool is every family's.
//
// Request: POST { unified: true, google: true, lat, lng, radiusKm?, familyKeys? }
//   radiusKm  the saved pin's radius, clamped to 1..50; missing or not a
//             number = `map.radiusKm` (log `radius: "operator"`).
//   lat/lng   a POINT; none = no location (Mesita Popularity only,
//             Popularity alone). Home never asks for an area: saved
//             areas (Territory) were retired 2026-10-20 (MESITA-2500), so a
//             `bounds` an old build still sends is ignored and logged as
//             `bounds_ignored`; drop that log once it stays quiet.
//   google    ignored since MESITA-2872 (no Google stub comes back).
//   No reviews minimum (MESITA-2721): the Popularity floor cuts.
// Response: { ok, location: { kind, radiusKm, operatorRadiusKm },
//   places: [... { area }],
//   summary }.
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
import { decideNearby } from "../_shared/geo.ts";
import {
  areaPoolLogFields,
  type PoolRow,
  type PoolBuilder,
  requestRadiusKm,
  resolveAreaLocation,
  selectAreaPool,
  selectedPoolQuery,
} from "../_shared/area-pipeline.ts";
import { readGuestFamilyKeys } from "../_shared/place-taxonomy.ts";

const POOL_CAP = 1000;

type Body = {
  lat?: number;
  lng?: number;
  /** The saved pin's radius (MESITA-2703); absent = `map.radiusKm`. */
  radiusKm?: unknown;
  /** Sent by builds from before MESITA-2500; ignored, only logged. */
  bounds?: unknown;
  /** Ignored since MESITA-2872: no Google stub comes back. */
  google?: boolean;
  /** Ignored since MESITA-2417; no reviews minimum since MESITA-2721. */
  minReviews?: unknown;
  /** Ignored since MESITA-2398; every build sends unified. */
  unified?: unknown;
  /** Ignored since MESITA-2516: one ranking, the Map's. */
  prefer?: unknown;
  /** The family row's families (MESITA-2438); absent or empty = every family. */
  familyKeys?: unknown;
};

function wirePlaces(rows: unknown[]): PoolRow[] {
  return (rows as PlaceProfileRow[]).map((r) => {
    const out = stripInternal(r);
    return {
      ...out,
      id: r.id,
      photos: Array.isArray(out.photos) ? out.photos : [],
    } as PoolRow; // photos already effective via stripInternal
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
  const admin = adminClient(env);
  const cfg = await loadDiscoveryConfig(admin);
  const nearby = decideNearby(body as Record<string, unknown>);
  const center = nearby.mode === "ok" ? { lat: nearby.lat, lng: nearby.lng } : null;
  // Validated before it reaches the Mesita box.
  const radius = requestRadiusKm(body.radiusKm, cfg.map.radiusKm);
  const radiusKm = radius.km;
  // Home ranks from a point or nothing (MESITA-2500): saved areas are gone.
  if (body.bounds !== undefined && body.bounds !== null) {
    console.log(JSON.stringify({ fn: "consumer-web-list-catalog", event: "bounds_ignored" }));
  }
  const location = resolveAreaLocation(center, radiusKm);
  const families = readGuestFamilyKeys(body.familyKeys).filter((f) => f !== "undefined");

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

  const pool = await selectAreaPool<PoolRow>({
    surface: "catalog",
    location,
    families,
    mesitaRows,
    cfg,
  });

  console.log(JSON.stringify({
    fn: "consumer-web-list-catalog",
    wire: "unified",
    location: location.kind,
    radius: radius.from,
    radiusKm,
    familyKeys: families,
    ...pool.summary,
    mesitaRead: mesitaRows.length,
    mesitaCapped: mesitaRows.length >= POOL_CAP,
    ...areaPoolLogFields(pool.places),
  }));

  return json({
    ok: true,
    // The radius searched and the operator's current-location radius
    // (MESITA-2703): the client names both in the location sheet.
    location: { kind: location.kind, radiusKm, operatorRadiusKm: cfg.map.radiusKm },
    places: pool.places,
    summary: pool.summary,
  });
});
