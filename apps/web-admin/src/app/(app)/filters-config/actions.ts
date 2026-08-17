"use server";

// Server actions for Filters Config (MESITA-1083). Thin wrappers over the
// admin-web-* Edge Functions via the Result-style efInvoke (never throws) —
// the same contract as the Promos / Reservations / Sourcing / Memo actions.
//
// Backed by admin-web-get-filters-config / admin-web-update-filters-config.
// app_settings.filters_config.v1 is the source of truth. No client touches
// the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { coerceFiltersConfig, type FiltersConfig } from "./filters";

type GetFiltersConfigResult =
  | { ok: true; config: FiltersConfig; updatedAt: string | null; seeded: boolean }
  | { ok: false; error: string };

export async function getFiltersConfig(): Promise<GetFiltersConfigResult> {
  const r = await efInvoke<{
    config?: unknown;
    updatedAt: string | null;
  }>("admin-web-get-filters-config", {});
  if (!r.ok) return { ok: false, error: r.error };

  // `seeded` = no blob saved yet, so the knobs on screen are the code defaults
  // (which mirror the shipped consumer engine). The page says so, because
  // "these are the launch values" and "an operator chose these" are different
  // claims and only one of them is true before the first save.
  const seeded = !r.data.config;
  return {
    ok: true,
    config: coerceFiltersConfig(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
    seeded,
  };
}

type UpdateFiltersConfigResult =
  | { ok: true; config: FiltersConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateFiltersConfig(
  config: FiltersConfig,
): Promise<UpdateFiltersConfigResult> {
  // A WHOLE-BLOB write, like Promos: General and every surface ship on every
  // save, and the EF normalizer always returns a complete v1. Saving from the
  // Swipe tab therefore persists General untouched rather than dropping it.
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-filters-config",
    { config },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: coerceFiltersConfig(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}
