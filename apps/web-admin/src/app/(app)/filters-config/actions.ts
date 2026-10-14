"use server";

// Server actions for Discovery. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws) — same contract as
// the other config pages' actions.
//
// Backed by the `discovery` section of admin-web-get-config /
// admin-web-update-config, which read and write the discovery_config jsonb on
// the public.app_config singleton. No client ever touches the DB.

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import { coerceConfig, type DiscoveryConfig } from "./catalog";

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
  | "filters"
  | "map"
  // Narrow map slices (MESITA-1681, widened by MESITA-1695). Families
  // (Configurations › Families), Google Nearby's floor, and Google Nearby's
  // pull all write `map`. Whole-slice saves from those seeds mean the last
  // Save wipes the others, so each writes only its own fields. `map` stays
  // for the Map mode box, which owns the rest.
  | "mapSupers"
  | "mapFloors"
  | "mapPull"
  // Narrow weight slices (MESITA-1859). The weights table on Discovery Modes
  // has ONE SAVE PER COLUMN, and `weights` and `params` both ride the single
  // `signals` slice below — so a per-column save of the whole slice would be
  // the mapSupers/mapFloors/mapPull incident again, one floor up: saving Map
  // would silently revert Scroll and the signal params. Each column writes
  // only its own mode key.
  | "weightsMap"
  | "weightsScroll"
  | "nameFast"
  | "nameDeep"
  | "swipe"
  | "signals"
  // The Catalog page. One profile, written once, shared by the seven lists.
  | "catalogRanking";

export async function updateDiscoveryConfig(
  config: DiscoveryConfig,
  slices: DiscoverySlice[],
): Promise<UpdateDiscoveryConfigResult> {
  const live = await getDiscoveryConfig();
  if (!live.ok) return live;
  const keys = new Set(slices);
  const next: DiscoveryConfig = {
    ...live.config,
    general: keys.has("general") ? config.general : live.config.general,
    // The operator floor for the listed Mesita pool — Home rails, Pay / bbox,
    // Swipe. Until MESITA-1667 this slice had no member here at all, so it
    // rode through every save on `...live.config` and no console could reach
    // it while `applyDiscoveryFilters` enforced it on every one of those lanes.
    filters: keys.has("filters") ? config.filters : live.config.filters,
    map: {
      ...(keys.has("map") ? config.map : live.config.map),
      ...(keys.has("mapSupers") ? { supers: config.map.supers } : null),
      ...(keys.has("mapFloors")
        ? { minRating: config.map.minRating, minReviews: config.map.minReviews }
        : null),
      ...(keys.has("mapPull") ? { googlePull: config.map.googlePull } : null),
    },
    name: {
      fast: keys.has("nameFast") ? config.name.fast : live.config.name.fast,
      deep: keys.has("nameDeep") ? config.name.deep : live.config.name.deep,
    },
    swipe: keys.has("swipe")
      ? { ...config.swipe, savedAt: new Date().toISOString() }
      : live.config.swipe,
    // Per-mode, never whole-slice: `weightsMap` touches `map` and nothing
    // else, so the two columns cannot overwrite each other.
    weightsByMode: {
      ...live.config.weightsByMode,
      ...(keys.has("weightsMap") ? { map: config.weightsByMode.map } : null),
      ...(keys.has("weightsScroll") ? { swipe: config.weightsByMode.swipe } : null),
    },
    // The global vector stays on `signals`. No console edits it directly any
    // more — it is Word's vector and the per-mode fallback — but a params save
    // must not drop it.
    weights: keys.has("signals") ? config.weights : live.config.weights,
    params: keys.has("signals") ? config.params : live.config.params,
    catalog: keys.has("catalogRanking")
      ? { ...live.config.catalog, ranking: config.catalog.ranking }
      : live.config.catalog,
  };
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-config",
    { section: "discovery", config: next },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}
