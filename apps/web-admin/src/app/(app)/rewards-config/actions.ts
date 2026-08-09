"use server";

// Server actions for Promos Config (v10, MESITA-991). Thin wrappers over the
// admin-web-* Edge Functions via the Result-style efInvoke (never throws) —
// same contract as the Reservations / Sourcing / Memo config actions.
//
// Backed by admin-web-get-rewards-config / admin-web-update-rewards-config.
// The v10 blob in app_settings.rewards_config is the source of truth; the EF
// keeps the legacy best-of reward_rules in sync on every save so the LIVE
// engine tracks operator edits until the additive flip ships (MESITA-992).
// No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import {
  coercePromosConfig,
  seedFromLegacyRules,
  snapCap,
  type PromosConfig,
} from "./promos";

type GetPromosConfigResult =
  | {
      ok: true;
      config: PromosConfig;
      updatedAt: string | null;
      /** True when no v10 blob exists yet and the knobs were derived from the legacy rule table — review, then Save. */
      seeded: boolean;
    }
  | { ok: false; error: string };

export async function getPromosConfig(): Promise<GetPromosConfigResult> {
  const r = await efInvoke<{
    config?: unknown;
    rules?: unknown;
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

  // First load before any v10 save: derive the knobs from the stored legacy
  // rules (exact for formula-shaped tables) and the cap from the blob scalar.
  const seeded = seedFromLegacyRules(r.data.rules);
  const config = seeded
    ? { ...seeded, cap: snapCap(r.data.cap) }
    : coercePromosConfig({ cap: r.data.cap });
  return {
    ok: true,
    config,
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
