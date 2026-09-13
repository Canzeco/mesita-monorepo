"use server";

// Server actions for Discovery. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws) — same contract as
// the Sourcing / Memo / Atlas config actions.
//
// Backed by the `discovery` section of admin-web-get-config /
// admin-web-update-config, which read and write the discovery_config jsonb on
// the public.app_config singleton. No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { coerceConfig, type DiscoveryConfig } from "./catalog";

type GetDiscoveryConfigResult =
  | { ok: true; config: DiscoveryConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getDiscoveryConfig(): Promise<GetDiscoveryConfigResult> {
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-get-config",
    { section: "discovery" },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}

type UpdateDiscoveryConfigResult =
  | { ok: true; config: DiscoveryConfig; updatedAt: string | null }
  | { ok: false; error: string };

export type DiscoverySlice =
  | "general"
  | "filters"
  | "catalog"
  | "social"
  | "chat"
  | "map"
  // Narrow map slices (MESITA-1681, widened by MESITA-1695). Search Sources
  // holds THREE boxes that write `map`: the Super Categories strip, Google
  // Nearby's floor, and Google Nearby's pull. Whole-slice saves from three
  // seeds on one page mean the last Save wipes the others, so each writes only
  // its own fields. `map` stays for the Map mode box, which owns the rest.
  | "mapSupers"
  | "mapFloors"
  | "mapPull"
  | "nameFast"
  | "nameDeep"
  | "swipe"
  | "signals";

export async function updateDiscoveryConfig(
  config: DiscoveryConfig,
  slices?: DiscoverySlice[],
): Promise<UpdateDiscoveryConfigResult> {
  const live = await getDiscoveryConfig();
  if (!live.ok) return live;
  const keys = new Set(
    slices ??
      ([
        "general",
        "filters",
        "catalog",
        "social",
        "chat",
        "map",
        "nameFast",
        "nameDeep",
        "swipe",
        "signals",
      ] as const),
  );
  const next: DiscoveryConfig = {
    ...live.config,
    general: keys.has("general") ? config.general : live.config.general,
    // The operator floor for the listed Mesita pool — Home rails, Pay / bbox,
    // Swipe. Until MESITA-1667 this slice had no member here at all, so it
    // rode through every save on `...live.config` and no console could reach
    // it while `applyDiscoveryFilters` enforced it on every one of those lanes.
    filters: keys.has("filters") ? config.filters : live.config.filters,
    catalog: keys.has("catalog") ? config.catalog : live.config.catalog,
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
    social: keys.has("social") ? config.social : live.config.social,
    chat: keys.has("chat") ? config.chat : live.config.chat,
    swipe: keys.has("swipe")
      ? { ...config.swipe, savedAt: new Date().toISOString() }
      : live.config.swipe,
    weights: keys.has("signals") ? config.weights : live.config.weights,
    params: keys.has("signals") ? config.params : live.config.params,
    slotting: keys.has("signals") ? config.slotting : live.config.slotting,
  };
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-config",
    { section: "discovery", config: next },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}
