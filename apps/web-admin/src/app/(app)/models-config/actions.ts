"use server";

// Server actions for Models Config. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws) — same contract as the
// Memo / Atlas config actions.
//
// Backed by admin-web-get-models-config / admin-web-update-models-config, which
// read and write the models_config jsonb blob on the public.app_settings
// singleton. STAGED: the blob round-trips today; the subsystems are pointed at
// it in a follow-up. No client ever touches the DB.
//
// Types + catalogs live in ./types (not here) — "use server" modules may only
// export async functions to the client.

import { efInvoke } from "@/lib/supabase-ef";
import { coerceModelsConfig, type ModelsConfig } from "./types";

export type { ModelsConfig } from "./types";

type GetModelsConfigResult =
  | { ok: true; data: ModelsConfig }
  | { ok: false; error: string };

export async function getModelsConfig(): Promise<GetModelsConfigResult> {
  const r = await efInvoke<{ config: unknown }>(
    "admin-web-get-models-config",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  // The EF returns { config: blob | null }; coerce merges null/partial → defaults.
  return { ok: true, data: coerceModelsConfig(r.data.config) };
}

type UpdateModelsConfigResult =
  | { ok: true; data: ModelsConfig }
  | { ok: false; error: string };

export async function updateModelsConfig(
  config: ModelsConfig,
): Promise<UpdateModelsConfigResult> {
  const r = await efInvoke<{ config: unknown }>(
    "admin-web-update-models-config",
    { config },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: coerceModelsConfig(r.data.config) };
}
