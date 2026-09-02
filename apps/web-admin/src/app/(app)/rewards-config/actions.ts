"use server";

// Server actions for Rewards Config (v10, MESITA-991). Thin wrappers over the
// admin-web-* Edge Functions via the Result-style efInvoke (never throws) —
// same contract as the Reservations / Sourcing / Memo config actions.
//
// Backed by admin-web-get-rewards-config / admin-web-update-rewards-config.
// The v10 blob in app_config.promos_config is the ONLY source of truth — the
// legacy best-of rule table is gone, so what this page saves is what the LIVE
// engine prices (MESITA-992).
// No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { coercePromosConfig, type PromosConfig } from "./promos";

type GetPromosConfigResult =
  | {
      ok: true;
      config: PromosConfig;
      updatedAt: string | null;
      /** True when no v10 blob exists yet and the knobs are the launch defaults — review, then Save. */
      seeded: boolean;
    }
  | { ok: false; error: string };

export async function getPromosConfig(): Promise<GetPromosConfigResult> {
  const r = await efInvoke<{
    config?: unknown;
    cap?: unknown;
    updatedAt: string | null;
  }>("admin-web-get-rewards-config", {});
  if (!r.ok) return { ok: false, error: r.error };

  if (r.data.config) {
    return {
      ok: true,
      config: coercePromosConfig(r.data.config),
      updatedAt: r.data.updatedAt ?? null,
      seeded: false,
    };
  }

  // First load before any v10 save: nothing is stored but the cap scalar, so
  // the page opens on the launch defaults carrying that cap — review, then Save.
  return {
    ok: true,
    config: coercePromosConfig({ cap: r.data.cap }),
    updatedAt: r.data.updatedAt ?? null,
    seeded: true,
  };
}

type UpdatePromosConfigResult =
  | { ok: true; config: PromosConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updatePromosConfig(
  config: PromosConfig,
): Promise<UpdatePromosConfigResult> {
  // A WHOLE-BLOB write: the promos model is one coherent thing, so every knob
  // ships on every save and the EF normalizes the complete v10 shape.
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-rewards-config",
    { config },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: coercePromosConfig(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}
