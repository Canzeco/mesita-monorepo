// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// THE CATALOG PIPELINE (Home's Places; split from Area by MESITA-2909,
// `_shared/area-pipeline.ts`). Every ready Mesita place (the family row's
// families pushed into the read) is gated, scored and ranked from its
// scoring columns, the best 1000 BY RANK keep their cards (MESITA-2921:
// a capped id-ordered read ranked a random 1000), and that ranked list
// comes back; the client pages it by `pageSize` (`map.catalogPageSize`).
// Nothing here calls Google (MESITA-2872).
//
// NO RADIUS (Pato, MESITA-2909: "en Catalog no nos importa … no hay un
// radio"): distance never cuts a place. THE SCORE: Proximity × Popularity ×
// the Premier factor (a Premier place's paid tier, ×2 · ×5 · ×10,
// MESITA-2925), Proximity = 1 ÷ (1 + ln(1 + (e − 1) · d ÷ h)), h the
// operator's half distance (`params.proximity.halfKm`): 1 at the guest, ½
// at h, falling fast and then ever slower. No point: Popularity × the factor.
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
//   summary.read      pass-1 rows read (scoring columns)
//   summary.total     rows that passed the gates and were ranked
//   summary.returned  places emitted (≤ 1000)
//   summary.chunks    pass-2 card reads
//   summary.scanCapped  10,000 rows read and more remain: cut by id again
//   summary.missing   kept ids pass 2 did not return
// Error: 502 { ok: false, code: "catalog_read_failed", error, pass, page |
//   chunk, requestId }; the PostgREST message is logged, never sent.
//   Read-only, safe to retry.
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
  CatalogReadError,
  type PoolBuilder,
  type PoolRow,
  resolveAreaLocation,
  selectCatalogPool,
} from "../_shared/area-pipeline.ts";
import { readGuestFamilyKeys } from "../_shared/place-taxonomy.ts";

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

  const requestId = crypto.randomUUID();
  const started = Date.now();
  let pool: Awaited<ReturnType<typeof selectCatalogPool<PoolRow>>>;
  try {
    pool = await selectCatalogPool<PoolRow>({
      read: (columns) =>
        admin.from("profiles").select(columns).eq("state", "active") as unknown as PoolBuilder,
      cfg,
      location,
      families,
      // Card columns only: no Catalog signal reads the summary vector, so the
      // pool does not select it (MESITA-2328).
      cardColumns: PLACE_CARD_COLUMNS,
      wire: wirePlaces,
    });
  } catch (err) {
    if (!(err instanceof CatalogReadError)) throw err;
    const at = err.pass === 1 ? { page: err.at } : { chunk: err.at };
    console.error(JSON.stringify({
      fn: "consumer-web-list-catalog",
      event: "catalog_page_error",
      requestId,
      pass: err.pass,
      ...at,
      pgCode: err.pgCode,
      message: err.message,
    }));
    return json({
      ok: false,
      code: "catalog_read_failed",
      error: "Catalog read failed",
      pass: err.pass,
      ...at,
      requestId,
    }, 502);
  }

  if (pool.summary.scanCapped) {
    console.warn(JSON.stringify({
      fn: "consumer-web-list-catalog",
      event: "catalog_scan_capped",
      requestId,
      read: pool.summary.read,
      lastId: pool.lastId,
      trigger: "MESITA-2921: rank in SQL or page the server",
    }));
  }

  console.log(JSON.stringify({
    fn: "consumer-web-list-catalog",
    wire: "unified",
    requestId,
    ms: Date.now() - started,
    location: location.kind,
    familyKeys: families,
    ...pool.summary,
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
