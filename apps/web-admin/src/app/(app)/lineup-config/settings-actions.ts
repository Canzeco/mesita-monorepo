"use server";

// Server actions for the Params tab's Save/Reset — thin wrappers over the
// admin-web-*-lineup-config EF pair (app_settings.scoring_config jsonb;
// NOT NULL with locked v12 defaults since MESITA-737). "use server" because
// the Save button is a client component; only async exports are allowed
// here, which is why these live apart from ./actions.ts (it exports
// consts/types).

import { efInvoke } from "@/lib/supabase-ef";

type SettingsResult =
  | { ok: true; config: unknown }
  | { ok: false; error: string };

/** Saved hyperparameters, raw (column is NOT NULL; coerce still tolerates null). */
export async function getScoringSettings(): Promise<SettingsResult> {
  const r = await efInvoke<{ config: unknown }>("admin-web-get-lineup-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: r.data?.config ?? null };
}

/** Whole-blob save. The EF validates structure and clamps ranges. */
export async function updateScoringSettings(config: unknown): Promise<SettingsResult> {
  const r = await efInvoke<{ config: unknown }>("admin-web-update-lineup-config", { config });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: r.data?.config ?? null };
}
