"use server";

// Server actions for Controls Config. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws). Backed by
// admin-web-get/update-controls-config on app_config.controls_config.
// WHOLE-BLOB save: the knobs are a related set — the ceiling can never sit
// below the floor, the default hold has to be a value inside the window it is
// the default for, and Credits may never expire before they mature, which ties
// the expiry floor to the hold ceiling. No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { CONTROLS_FALLBACK, type ControlsConfig } from "./defaults";

type ConfigPayload = { config: unknown; updatedAt: string | null };

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

// Mirrors supabase/functions/_shared/controls-config.ts — the EF is
// authoritative; this keeps the form honest if the blob is older than the
// current shape.
function normalize(raw: unknown): ControlsConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const minHold = Math.round(
    num(r.minHoldHours, CONTROLS_FALLBACK.minHoldHours, 0, 720),
  );
  const maxHold = Math.max(
    minHold,
    Math.round(num(r.maxHoldHours, CONTROLS_FALLBACK.maxHoldHours, 0, 720)),
  );
  // Credits may never expire before they mature: the shortest life a place may
  // sell has to outlast the longest hold it may set. HOURS on the left of the
  // slash, DAYS on the right — the two knobs wear different units on purpose.
  const minExpiry = Math.max(
    Math.ceil(maxHold / 24),
    Math.round(num(r.minExpiryDays, CONTROLS_FALLBACK.minExpiryDays, 0, 3650)),
  );
  const defaultExpiry = Math.max(
    minExpiry,
    Math.round(
      num(r.defaultExpiryDays, CONTROLS_FALLBACK.defaultExpiryDays, 0, 3650),
    ),
  );
  return {
    defaultHoldHours: Math.min(
      maxHold,
      Math.max(
        minHold,
        Math.round(
          num(r.defaultHoldHours, CONTROLS_FALLBACK.defaultHoldHours, 0, 720),
        ),
      ),
    ),
    defaultBonusPct: Math.round(
      num(r.defaultBonusPct, CONTROLS_FALLBACK.defaultBonusPct, 0, 100),
    ),
    maxHoldHours: maxHold,
    minHoldHours: minHold,
    defaultExpiryDays: defaultExpiry,
    minExpiryDays: minExpiry,
  };
}

type GetResult =
  | { ok: true; config: ControlsConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getControlsConfig(): Promise<GetResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-get-controls-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalize(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}

type UpdateResult =
  | { ok: true; config: ControlsConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateControlsConfig(
  config: ControlsConfig,
): Promise<UpdateResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-update-controls-config", {
    config,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalize(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}
