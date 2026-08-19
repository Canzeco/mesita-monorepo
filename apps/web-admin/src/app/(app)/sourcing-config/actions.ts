"use server";

// Server actions for Sourcing Config. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws) — same contract as the
// Memo / Atlas config actions.
//
// Backed by admin-web-get-sourcing-config / admin-web-update-sourcing-config,
// which read and write the sourcing_config jsonb on the public.app_config
// singleton. No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { coerceConfig, type SourcingConfig } from "./catalog";

type GetSourcingConfigResult =
  | { ok: true; config: SourcingConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getSourcingConfig(): Promise<GetSourcingConfigResult> {
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-get-sourcing-config",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}

type UpdateSourcingConfigResult =
  | { ok: true; config: SourcingConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateSourcingConfig(
  config: SourcingConfig,
): Promise<UpdateSourcingConfigResult> {
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-sourcing-config",
    { config },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}
