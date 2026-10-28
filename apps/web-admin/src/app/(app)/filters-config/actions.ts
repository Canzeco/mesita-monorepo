"use server";

// Server actions for Discovery (Params). Thin wrappers over the admin-web-* Edge
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
  // The Map box (MESITA-2909): all of `map` but the Catalog's page size.
  | "mapPipeline"
  // A narrow map slice (MESITA-1681): the Map floors write only
  // its own fields of `map` (the Families switches, `mapSupers`, went in
  // MESITA-2687).
  | "mapFloors"
  | "nameFast"
  | "nameDeep"
  // The Chat Agent's prompt (MESITA-2303), on the Deep box since MESITA-2327.
  | "chat"
  // The Catalog box (MESITA-2909): `map.catalogPageSize` and all of
  // `params` (Proximity's half distance; Popularity's stored reference rides
  // along, MESITA-2328).
  | "catalogPipeline"
  | "deep"
  // Name's Locations switch (MESITA-2319).
  | "nameLocations"
  // Name's idle seconds and Name by Admin's caps (MESITA-2322).
  | "nameIdle"
  | "nameAdmin";

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
    map: {
      ...(keys.has("mapPipeline") ? config.map : live.config.map),
      catalogPageSize: keys.has("catalogPipeline")
        ? config.map.catalogPageSize
        : live.config.map.catalogPageSize,
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
    },
    params: keys.has("catalogPipeline") ? config.params : live.config.params,
    deep: keys.has("deep") ? config.deep : live.config.deep,
    chat: keys.has("chat") ? config.chat : live.config.chat,
  };
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-config",
    { section: "discovery", config: next },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}
