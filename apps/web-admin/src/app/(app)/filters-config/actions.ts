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

export async function updateDiscoveryConfig(
  config: DiscoveryConfig,
): Promise<UpdateDiscoveryConfigResult> {
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-discovery-config",
    { config },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}
