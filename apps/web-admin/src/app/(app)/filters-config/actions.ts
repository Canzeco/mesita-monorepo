"use server";

// Server actions for Discovery. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws) — same contract as
// the Sourcing / Memo / Atlas config actions.
//
// Backed by admin-web-get-discovery-config / admin-web-update-discovery-config,
// which read and write the discovery_config jsonb on the public.app_config
// singleton. No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { coerceConfig, type DiscoveryConfig } from "./catalog";

type GetDiscoveryConfigResult =
  | { ok: true; config: DiscoveryConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getDiscoveryConfig(): Promise<GetDiscoveryConfigResult> {
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-get-discovery-config",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}

type UpdateDiscoveryConfigResult =
  | { ok: true; config: DiscoveryConfig; updatedAt: string | null }
  | { ok: false; error: string };

export type DiscoverySlice =
  | "catalog"
  | "social"
  | "chat"
  | "map"
  | "nameFast"
  | "nameDeep";

export async function updateDiscoveryConfig(
  config: DiscoveryConfig,
  slices?: DiscoverySlice[],
): Promise<UpdateDiscoveryConfigResult> {
  const live = await getDiscoveryConfig();
  if (!live.ok) return live;
  const keys = new Set(
    slices ?? (["catalog", "social", "chat", "map", "nameFast", "nameDeep"] as const),
  );
  const next: DiscoveryConfig = {
    ...live.config,
    catalog: keys.has("catalog") ? config.catalog : live.config.catalog,
    map: keys.has("map") ? config.map : live.config.map,
    name: {
      fast: keys.has("nameFast") ? config.name.fast : live.config.name.fast,
      deep: keys.has("nameDeep") ? config.name.deep : live.config.name.deep,
    },
    social: keys.has("social") ? config.social : live.config.social,
    chat: keys.has("chat") ? config.chat : live.config.chat,
  };
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-discovery-config",
    { config: next },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}
