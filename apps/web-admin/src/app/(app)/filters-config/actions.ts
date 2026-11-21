"use server";

// Server actions for Discovery (Params). Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws) — same contract as
// the other config pages' actions.
//
// Backed by the `discovery` section of admin-web-get-config /
// admin-web-update-config, which read and write the discovery_config jsonb on
// the public.app_config singleton. No client ever touches the DB.
//
// THE WRITE (MESITA-4454). Each card saves only its own slices, laid over a
// fresh read of the live blob, and the server lays that again over what it
// stores (`params` and `map` merge one level down), so no card can erase
// another card's keys, and an unknown key survives (H-2). With
// `expectedUpdatedAt` (the stamp the page last saw) the server refuses a
// stale page with 409 `config_conflict` (H-3, DX-g). After a save the answer
// must carry what was written, or the server that took it is an older build
// that dropped it.

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import { coerceConfig, type DiscoveryConfig, type RankMode } from "./catalog";

type GetDiscoveryConfigResult = ActionResult<{
  config: DiscoveryConfig;
  updatedAt: string | null;
}>;

export async function getDiscoveryConfig(): Promise<GetDiscoveryConfigResult> {
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-get-config",
    { section: "discovery" },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}

type UpdateDiscoveryConfigResult = ActionResult<{
  config: DiscoveryConfig;
  updatedAt: string | null;
}>;

export type DiscoverySlice =
  | "general"
  // The Map display card (MESITA-4454): the pin counts and the reload
  // timing of `map`, never the Catalog's page size or the floors.
  | "mapDisplay"
  // A narrow map slice (MESITA-1681): the Map floors write only
  // its own fields of `map` (the Families switches, `mapSupers`, went in
  // MESITA-2687).
  | "mapFloors"
  | "nameFast"
  | "nameDeep"
  // The Chat Agent's prompt (MESITA-2303), on the Deep box since MESITA-2327.
  | "chat"
  // The Ranking card (MESITA-4454): `params.recipes`, sent whole.
  | "ranking"
  // The Mixing card (MESITA-4454): `params.mix`, sent whole. It no longer
  // writes `map.catalogPageSize` (MESITA-4517: the lanes' batches size
  // each weave); the stored value loads and is ignored.
  | "mixing"
  | "deep"
  // The Social discovery card (MESITA-4572): `social`, sent whole.
  | "social"
  // Name's Locations switch (MESITA-2319).
  | "nameLocations"
  // Name's idle seconds and Name by Admin's caps (MESITA-2322).
  | "nameIdle"
  | "nameAdmin"
  // Name's Minimum Popularity (MESITA-3086): only the Name box writes it.
  | "nameFloor"
  // Premier's monthly prices (MESITA-3043): only the Premier Prices box.
  | "premier";

/** The `map` keys the Map display card owns (MESITA-4454). */
const MAP_DISPLAY_KEYS = ["placesShown", "dotsShown", "reloadIdleSec", "reloadMinViewportPct"] as const;

/** Shown when the row moved since the page read it (409 config_conflict). */
const CONFLICT = "Config changed, reload";
/** Shown when the answer lacks a slice just written: an older server build
 *  took the save and dropped it. */
const OLDER_SERVER = "Saved by an older server, retry";

function pick<T extends object, K extends keyof T>(o: T, keys: readonly K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) out[k] = o[k];
  return out;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

/** Every slice the save wrote is in the server's answer (H-2). Only the
 *  MESITA-4454 slices can be missing: an older build dropped them. */
function carriesWrittenSlices(raw: unknown, keys: ReadonlySet<DiscoverySlice>): boolean {
  const params = isObject(raw) && isObject(raw.params) ? raw.params : {};
  if (keys.has("ranking") && !isObject(params.recipes)) return false;
  if (keys.has("mixing") && !isObject(params.mix)) return false;
  return true;
}

export async function updateDiscoveryConfig(
  config: DiscoveryConfig,
  slices: DiscoverySlice[],
  expectedUpdatedAt?: string | null,
): Promise<UpdateDiscoveryConfigResult> {
  const live = await getDiscoveryConfig();
  if (!live.ok) return live;
  const keys = new Set(slices);
  const next: DiscoveryConfig = {
    ...live.config,
    general: keys.has("general") ? config.general : live.config.general,
    map: {
      ...live.config.map,
      ...(keys.has("mapDisplay") ? pick(config.map, MAP_DISPLAY_KEYS) : null),
      ...(keys.has("mapFloors")
        ? { minRating: config.map.minRating, minReviews: config.map.minReviews }
        : null),
    },
    name: {
      fast: keys.has("nameFast") ? config.name.fast : live.config.name.fast,
      deep: keys.has("nameDeep") ? config.name.deep : live.config.name.deep,
      locations: keys.has("nameLocations")
        ? config.name.locations
        : live.config.name.locations,
      idleSec: keys.has("nameIdle") ? config.name.idleSec : live.config.name.idleSec,
      admin: keys.has("nameAdmin") ? config.name.admin : live.config.name.admin,
      popularityFloor: keys.has("nameFloor")
        ? config.name.popularityFloor
        : live.config.name.popularityFloor,
    },
    params: {
      ...live.config.params,
      ...(keys.has("ranking") ? { recipes: config.params.recipes } : null),
      ...(keys.has("mixing") ? { mix: config.params.mix } : null),
    },
    deep: keys.has("deep") ? config.deep : live.config.deep,
    chat: keys.has("chat") ? config.chat : live.config.chat,
    premier: keys.has("premier") ? config.premier : live.config.premier,
    social: keys.has("social") ? config.social : live.config.social,
  };
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-config",
    {
      section: "discovery",
      config: next,
      ...(expectedUpdatedAt ? { expectedUpdatedAt } : null),
    },
  );
  if (!r.ok) {
    if (r.status === 409 || r.code === "config_conflict") return { ok: false, error: CONFLICT };
    return { ok: false, error: r.error };
  }
  if (!carriesWrittenSlices(r.data.config, keys)) return { ok: false, error: OLDER_SERVER };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}

export type RankPreviewRow = { id: string; name: string; lane: "organic" | "inorganic" };
export type RankPreviewPage = {
  organic: RankPreviewRow[];
  inorganic: RankPreviewRow[];
  merged: RankPreviewRow[];
  shuffled: RankPreviewRow[];
};

const EMPTY_PAGE: RankPreviewPage = { organic: [], inorganic: [], merged: [], shuffled: [] };

/** The first page the edited recipes would rank, beside the saved ones
 *  (MESITA-4458). Nothing is written. */
export async function previewDiscoveryRank(
  lat: number,
  lng: number,
  mode: RankMode,
  recipes: DiscoveryConfig["params"]["recipes"],
): Promise<ActionResult<{ live: RankPreviewPage; draft: RankPreviewPage }>> {
  const r = await efInvoke<{ live: RankPreviewPage; draft: RankPreviewPage }>(
    "admin-web-preview-rank",
    { lat, lng, mode, recipes },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, live: r.data.live ?? EMPTY_PAGE, draft: r.data.draft ?? EMPTY_PAGE };
}
