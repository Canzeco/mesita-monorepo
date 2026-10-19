// Supabase Edge Function — consumer-web-list-catalog (product caller)
//
// The Feed: the Catalog VIEW of the Area pipeline (MESITA-2302, MESITA-2327,
// one pool since MESITA-2379, `_shared/area-pipeline.ts`). One round trip:
// `selectAreaPool` merges Google candidates (up to 20/40/60 — 1/2/3 billed
// Nearby calls, `map.googlePlaces`) and Mesita candidates
// (`map.mesitaPlaces`), dedupes them by Google Place ID, gates, scores,
// multiplies by the Selected factor and ranks them globally. The client
// pages the ranked pool and applies the Family gate on each place's
// `area.familyKeys` (the gate never moves a score, so the order holds), so a
// family change or a later page never re-pays Google.
//
// Request: POST { unified: true, google: true, lat, lng, bounds? }
//   bounds    a saved AREA's rectangle {low, high} (valid → Territory, no
//             Proximity); otherwise lat/lng make a POINT inside
//             `map.radiusKm`; neither = no location (Mesita only,
//             Popularity alone).
//   google    the client can render a Google-only stub; the operator's
//             `map.googleFill`, a key and the per-IP ledger also decide.
//   The Google reviews minimum is the operator's `map.googleMinReviews`
//   alone (MESITA-2417), on Google hits; never a Mesita floor.
// Response (unified): { ok, location: { kind }, places: [... { area }],
//   summary }. QUOTA: one load spends up to 3 of the per-IP 45 Nearby calls
//   a minute (about 15 cold loads per IP per minute); a partly refused
//   fan-out logs `quota: "partial"`.
//
// LEGACY (no `unified`): the old rails — Google Places, Mesita Selected,
// then one rail per family — cut from the same ranked pool with ONE Nearby
// call, at most `catalog.railCap` per rail, so a consumer build from before
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
  FEED_GOOGLE_TYPES,
  googleCallsForStop,
  type OwnedRow,
  type PoolBuilder,
  resolveAreaLocation,
  selectAreaPool,
  selectedPoolQuery,
} from "../_shared/area-pipeline.ts";
import { readAreaPrefer } from "../_shared/area-score.ts";
import { areaQuota, ownedLookup } from "../_shared/area-deps.ts";

const POOL_CAP = 1000;

type Body = {
  lat?: number;
  lng?: number;
  /** A saved area's rectangle. */
  bounds?: unknown;
  /** The client can render a Google-only stub. */
  google?: boolean;
  /** Ignored since MESITA-2417: `map.googleMinReviews` is the minimum. */
  minReviews?: unknown;
  /** The one-pool wire (MESITA-2379); absent = the legacy rails. */
  unified?: boolean;  /** The guest's Near/Popular toggle (MESITA-2425); absent = Near. */
  prefer?: unknown;
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
  const radiusKm = cfg.map.radiusKm;
  // The legacy wire never sent bounds; only the one-pool wire may ask for an area.
  const location = resolveAreaLocation(unified ? body.bounds : null, center, radiusKm);

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
      bounds: location.kind === "area" ? location.bounds : null,
      selectedOnly: false,
    },
  ).limit(POOL_CAP);

  if (error) {
    console.error("[list-catalog] pool:", error.message);
    return json({ ok: false, error: error.message }, 502);
  }
  const mesitaRows = wirePlaces(data ?? []);

  const googleOn = location.kind !== "none" &&
    mapShouldFillGoogle(wantsGoogleFill(body as Record<string, unknown>), cfg.map);
  const gmp = googleOn ? readGooglePlacesKey() : null;
  const pool = await selectAreaPool<OwnedRow>({
    apiKey: gmp?.ok ? gmp.key : null,
    location,
    families: [],
    types: googleOn ? FEED_GOOGLE_TYPES : [],
    googleCalls: googleOn ? (unified ? googleCallsForStop(cfg.map.googlePlaces) : 1) : 0,
    mesitaLimit: cfg.map.mesitaPlaces,
    mesitaRows,
    cfg,
    consumeQuota: areaQuota(req, admin, env.serviceKey),
    lookupOwned: ownedLookup(admin, PLACE_CARD_COLUMNS, "list-catalog", wirePlaces),
    prefer: readAreaPrefer(body.prefer),
  });

  // One line, because every failure mode here is a WRONG SET rather than an
  // error: Google switched off, a spent quota and a skewed client all look
  // like a thin catalog from the outside.
  console.log(JSON.stringify({
    fn: "consumer-web-list-catalog",
    wire: unified ? "unified" : "legacy",
    location: location.kind,
    prefer: readAreaPrefer(body.prefer),
    ...pool.summary,
    mesitaRead: mesitaRows.length,
    mesitaCapped: mesitaRows.length >= POOL_CAP,
    ...areaPoolLogFields(pool.places),
  }));

  if (unified) {
    return json({
      ok: true,
      location: { kind: location.kind },
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
