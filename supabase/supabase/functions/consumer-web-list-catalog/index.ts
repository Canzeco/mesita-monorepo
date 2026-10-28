// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// THE CATALOG PIPELINE (Home's Places; split from Area by MESITA-2909,
// `_shared/area-pipeline.ts`). One round trip: every ready Mesita place
// (the family row's families pushed into the read) is gated, scored and
// ranked, and the WHOLE ranked list comes back; the client pages it by
// `pageSize` (`map.catalogPageSize`). Nothing here calls Google
// (MESITA-2872).
//
// NO RADIUS (Pato, MESITA-2909: "en Catalog no nos importa … no hay un
// radio"): distance never cuts a place. THE SCORE: Proximity × Popularity ×
// the Selected boost, Proximity = 1 ÷ (1 + ln(1 + (e − 1) · d ÷ h)), h the
// operator's half distance (`params.proximity.halfKm`): 1 at the guest, ½
// at h, falling fast and then ever slower. No point: Popularity × the boost.
//
// A FAMILY ROW ASKS ITS OWN QUESTION (MESITA-2438): `familyKeys` pushes the
// Family gate into the Mesita read. Without it the pool is every family's.
//
// Request: POST { unified: true, google: true, lat, lng, familyKeys? }
//   lat/lng   a POINT; none = no location (Popularity alone).
//   radiusKm  ignored since MESITA-2909 (the Catalog has no radius); pins
//             carry none since MESITA-2914.
//   bounds    ignored (Territory retired, MESITA-2500).
//   google    ignored since MESITA-2872 (no Google stub comes back).
// Response: { ok, location: { kind }, pageSize,
//   places: [... { area }], summary }.
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
  resolveAreaLocation,
  selectAreaPool,
  selectedPoolQuery,
} from "../_shared/area-pipeline.ts";
import { readGuestFamilyKeys } from "../_shared/place-taxonomy.ts";

const POOL_CAP = 1000;

type Body = {
  lat?: number;
  lng?: number;
  /** Ignored since MESITA-2909: the Catalog has no radius. */
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
  // Home ranks from a point or nothing (MESITA-2500), with no radius
  // (MESITA-2909): the point only scores.
  if (body.bounds !== undefined && body.bounds !== null) {
    console.log(JSON.stringify({ fn: "consumer-web-list-catalog", event: "bounds_ignored" }));
  }
  const location = resolveAreaLocation(center, null);
  const families = readGuestFamilyKeys(body.familyKeys).filter((f) => f !== "undefined");

  // Card columns only: no Catalog signal reads the summary vector, so the pool
  // does not select it (MESITA-2328).
  const { data, error } = await selectedPoolQuery(
    admin
      .from("profiles")
      .select(PLACE_CARD_COLUMNS)
      .eq("state", "active") as unknown as PoolBuilder,
    cfg,
    // No centre, no box: the whole catalog (MESITA-2909).
    { center: null, radiusKm: 0, families, selectedOnly: false },
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
    familyKeys: families,
    ...pool.summary,
    mesitaRead: mesitaRows.length,
    mesitaCapped: mesitaRows.length >= POOL_CAP,
    ...areaPoolLogFields(pool.places),
  }));

  return json({
    ok: true,
    // No radius on the wire: the Catalog has none and the location sheet
    // names none (MESITA-2914).
    location: { kind: location.kind },
    pageSize: pool.summary.pageSize,
    places: pool.places,
    summary: pool.summary,
  });
});
