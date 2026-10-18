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
  // (Configurations › Atlas) and Google Nearby's floor both write `map`.
  // Whole-slice saves from those seeds mean the last Save wipes the others,
  // so each writes only its own fields. `map` stays for the Area box, which
  // owns the rest (the Nearby pull knob retired with MESITA-2298).
  | "mapSupers"
  | "mapFloors"
  | "nameFast"
  | "nameDeep"
  // The Chat Agent's prompt (MESITA-2303), on the Deep box since MESITA-2327.
  | "chat"
  // The Area box's Proximity half distance and Popularity reference: all of
  // `params` since the deck's numbers retired (MESITA-2328).
  | "areaSignals"
  | "deep"
  // Name's Locations switch and the Feed's places per row (MESITA-2319).
  | "nameLocations"
  | "catalogRows"
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
    // The operator floor for the listed Mesita pool (consumer-web-list-places'
    // listed lanes). No box edits it; it rides through every Save.
    filters: keys.has("filters") ? config.filters : live.config.filters,
    map: {
      ...(keys.has("map") ? config.map : live.config.map),
      ...(keys.has("mapSupers") ? { supers: config.map.supers } : null),
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
    params: keys.has("areaSignals") ? config.params : live.config.params,
    deep: keys.has("deep") ? config.deep : live.config.deep,
    chat: keys.has("chat") ? config.chat : live.config.chat,
    catalog: {
      ...live.config.catalog,
      ...(keys.has("catalogRows") ? { railCap: config.catalog.railCap } : null),
    },
  };
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-config",
    { section: "discovery", config: next },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}
