// Supabase Edge Function — admin-web-preview-rank
//
// MESITA-4458: the Ranking card saves eight recipe rows. Before Save, the
// operator picks a point and a mode and sees the first page that edited
// recipe would produce beside the page the saved recipe produces now.
// Both pages are the merged, shuffled first page (Organic and Inorganic),
// the same seed, so only the recipe differs. Nothing is written.
//
// Body: { lat, lng, mode: "nearby" | "popular" | "family", recipes }
// Response: { ok: true, live: Row[], draft: Row[] }
//   Row = { id, name, lane: "organic" | "inorganic" }
//   400 bad_request · 401/403 · 502 catalog_read_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { errorMessage } from "../_shared/errors.ts";
import {
  loadDiscoveryConfigWithMeta,
  normalizeRecipes,
  type DiscoveryConfig,
} from "../_shared/discovery-config.ts";
import { readGuestFamilyKeys } from "../_shared/place-taxonomy.ts";
import { PLACE_CARD_COLUMNS } from "../_shared/place-columns.ts";
import { stripInternal } from "../_shared/place-pool-shape.ts";
import type { PlaceProfileRow } from "../_shared/place-pool-shape.ts";
import {
  CatalogReadError,
  catalogPageSize,
  type CatalogPool,
  type PoolBuilder,
  type PoolRow,
  resolveAreaLocation,
  selectCatalogPool,
} from "../_shared/area-pipeline.ts";

const FN = "admin-web-preview-rank";
type RankMode = "nearby" | "popular" | "family";
const MODES = new Set<RankMode>(["nearby", "popular", "family"]);
const SEED = 1;

type Row = { id: string; name: string; lane: "organic" | "inorganic" };

function wirePlaces(rows: unknown[]): PoolRow[] {
  return (rows as PlaceProfileRow[]).map((r) => {
    const out = stripInternal(r);
    return { ...out, id: r.id, photos: Array.isArray(out.photos) ? out.photos : [] } as PoolRow;
  });
}

function firstPage(pool: CatalogPool): Row[] {
  const page = pool.summary.pageSize ?? pool.places.length;
  const byId = new Map(pool.places.map((p) => [p.id, p]));
  const ads = new Set(pool.adIds);
  const rows: Row[] = [];
  for (const id of pool.order.slice(0, page)) {
    const place = byId.get(id);
    const name = place && typeof place.name === "string" && place.name.trim() ? place.name : id;
    rows.push({ id, name, lane: ads.has(id) ? "inorganic" : "organic" });
  }
  return rows;
}

serveJson(FN, async (req) => {
  const ctx = await requireAdminRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;
  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const mode = body.mode;
  const lat = body.lat;
  const lng = body.lng;
  if (typeof mode !== "string" || !MODES.has(mode as RankMode)) {
    return json({ ok: false, code: "bad_request", error: "mode is nearby, popular or family" }, 400);
  }
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng) ||
    lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return json({ ok: false, code: "bad_request", error: "lat and lng are a point" }, 400);
  }
  const rankMode = mode as RankMode;
  try {
    const loaded = await loadDiscoveryConfigWithMeta(admin);
    const draft: DiscoveryConfig = {
      ...loaded.cfg,
      params: { ...loaded.cfg.params, recipes: normalizeRecipes(body.recipes) },
    };
    const location = resolveAreaLocation({ lat, lng }, null);
    const families = readGuestFamilyKeys(undefined).filter((f) => f !== "undefined");
    const read = (columns: string) =>
      admin.from("profiles").select(columns).eq("state", "active") as unknown as PoolBuilder;
    const rank = async (cfg: DiscoveryConfig): Promise<Row[]> => {
      const pool = await selectCatalogPool<PoolRow>({
        rank: (args) => admin.rpc("catalog_rank", args),
        rankLanes: (args) => admin.rpc("catalog_rank_lanes", args),
        read,
        cfg,
        location,
        families,
        cardColumns: PLACE_CARD_COLUMNS,
        wire: wirePlaces,
        mode: rankMode,
        seed: SEED,
        pageSize: catalogPageSize(cfg.map),
      });
      return firstPage(pool);
    };
    const [live, edited] = await Promise.all([rank(loaded.cfg), rank(draft)]);
    return json({ ok: true, live, draft: edited });
  } catch (err) {
    if (err instanceof CatalogReadError) {
      console.error(JSON.stringify({ fn: FN, event: "catalog_read_failed", pass: err.pass, message: err.message }));
      return json({ ok: false, code: "catalog_read_failed", error: "Catalog read failed" }, 502);
    }
    console.error(JSON.stringify({ fn: FN, event: "preview_failed", message: errorMessage(err) }));
    return json({ ok: false, code: "preview_failed", error: "Could not preview this recipe" }, 500);
  }
});
