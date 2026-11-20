// Supabase Edge Function — admin-web-preview-rank
//
// MESITA-4458: the Ranking card saves eight recipe rows. Before Save, the
// operator picks a point and a mode and sees the first page that edited
// recipe would produce beside the page the saved recipe produces now.
// Both answers are four first pages: Organic, Inorganic, the merge, and the
// shuffle. The same seed, so only the recipe differs. Nothing is written.
//
// Body: { lat, lng, mode: "nearby" | "popular" | "family", recipes }
// Response: { ok: true, live: Page, draft: Page }
//   Page = { organic, inorganic, merged, shuffled }, each a Row[]
//   Row = { id, name, lane: "organic" | "inorganic" }
//   400 bad_request · 401/403 · 502 catalog_read_failed

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { errorMessage } from "../_shared/errors.ts";
import {
  loadDiscoveryConfigWithMeta,
  mixFor,
  normalizeRecipes,
  type DiscoveryConfig,
} from "../_shared/discovery-config.ts";
import { readGuestFamilyKeys } from "../_shared/place-taxonomy.ts";
import {
  catalogPageSize,
  catalogRankLanesArgs,
  CatalogReadError,
  resolveAreaLocation,
} from "../_shared/area-pipeline.ts";
import { cutAndShuffle, mergeLanes } from "../_shared/pipeline-signals.ts";

const FN = "admin-web-preview-rank";
type RankMode = "nearby" | "popular" | "family";
const MODES = new Set<RankMode>(["nearby", "popular", "family"]);
const SEED = 1;

type Row = { id: string; name: string; lane: "organic" | "inorganic" };
type Page = { organic: Row[]; inorganic: Row[]; merged: Row[]; shuffled: Row[] };

function asIds(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
}

serveJson("admin-web-preview-rank", async (req) => {
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
    const rank = async (cfg: DiscoveryConfig): Promise<{ page: Page; ids: string[] }> => {
      const { data, error } = await admin.rpc("catalog_rank_lanes", catalogRankLanesArgs(cfg, location, families, rankMode));
      if (error) throw new CatalogReadError(1, 0, error.code ?? null, error.message);
      const answer = (data ?? {}) as Record<string, unknown>;
      const organic = asIds(answer.ids);
      const inorganic = asIds(answer.premier);
      const mix = mixFor(cfg);
      const merged = mergeLanes(organic, inorganic, mix.adEvery);
      const n = catalogPageSize(cfg.map);
      const shuffled = cutAndShuffle(merged.order, n, mix.temperature[rankMode], SEED);
      const ads = new Set(merged.adIds);
      const take = (list: readonly string[], laneOf: (id: string) => "organic" | "inorganic") =>
        list.slice(0, n).map((id) => ({ id, name: id, lane: laneOf(id) }));
      const page: Page = {
        organic: take(organic, () => "organic"),
        inorganic: take(inorganic, () => "inorganic"),
        merged: take(merged.order, (id) => ads.has(id) ? "inorganic" : "organic"),
        shuffled: take(shuffled, (id) => ads.has(id) ? "inorganic" : "organic"),
      };
      return { page, ids: [...page.organic, ...page.inorganic, ...page.merged, ...page.shuffled].map((r) => r.id) };
    };
    const [liveRaw, draftRaw] = await Promise.all([rank(loaded.cfg), rank(draft)]);
    const wanted = [...new Set([...liveRaw.ids, ...draftRaw.ids])];
    const names = new Map<string, string>();
    if (wanted.length > 0) {
      const { data, error } = await admin.from("profiles").select("id, name").in("id", wanted);
      if (error) throw new CatalogReadError(2, 0, error.code ?? null, error.message);
      for (const row of (data ?? []) as Array<{ id?: string; name?: string | null }>) {
        if (row.id && row.name && row.name.trim()) names.set(row.id, row.name);
      }
    }
    const namePage = (page: Page): Page => {
      const rows = (list: Row[]) => list.map((row) => ({ ...row, name: names.get(row.id) ?? row.id }));
      return { organic: rows(page.organic), inorganic: rows(page.inorganic), merged: rows(page.merged), shuffled: rows(page.shuffled) };
    };
    return json({ ok: true, live: namePage(liveRaw.page), draft: namePage(draftRaw.page) });
  } catch (err) {
    if (err instanceof CatalogReadError) {
      console.error(JSON.stringify({ fn: FN, event: "catalog_read_failed", pass: err.pass, message: err.message }));
      return json({ ok: false, code: "catalog_read_failed", error: "Catalog read failed" }, 502);
    }
    console.error(JSON.stringify({ fn: FN, event: "preview_failed", message: errorMessage(err) }));
    return json({ ok: false, code: "preview_failed", error: "Could not preview this recipe" }, 500);
  }
});
