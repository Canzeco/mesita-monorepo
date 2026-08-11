"use server";

// Server actions for Ojo Config. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws). Backed by
// admin-web-get/update-ojo-config on app_settings.ojo_config. WHOLE-BLOB save:
// the thresholds are a related set, so a per-key merge could persist an
// inverted band. No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { OJO_FALLBACK, type OjoConfig } from "./defaults";

type ConfigPayload = { config: unknown; updatedAt: string | null };

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

// Mirrors supabase/functions/_shared/ojo-config.ts — the EF is authoritative;
// this keeps the form honest if the blob is older than the current shape.
function normalize(raw: unknown): OjoConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const c = (r.checks ?? {}) as Record<string, unknown>;
  const autoPass = num(r.autoPassScore, OJO_FALLBACK.autoPassScore, 0, 1);
  return {
    enabled: bool(r.enabled, OJO_FALLBACK.enabled),
    autoPassScore: autoPass,
    reviewFloorScore: Math.min(
      autoPass,
      num(r.reviewFloorScore, OJO_FALLBACK.reviewFloorScore, 0, 1),
    ),
    failAction: r.failAction === "withhold" ? "withhold" : "flag",
    showGuestReason: bool(r.showGuestReason, OJO_FALLBACK.showGuestReason),
    maxRetries: Math.round(num(r.maxRetries, OJO_FALLBACK.maxRetries, 0, 10)),
    checks: {
      placeNameMatches: bool(
        c.placeNameMatches,
        OJO_FALLBACK.checks.placeNameMatches,
      ),
      isRightSurface: bool(c.isRightSurface, OJO_FALLBACK.checks.isRightSurface),
      ratingPresent: bool(c.ratingPresent, OJO_FALLBACK.checks.ratingPresent),
      recentTimestamp: bool(
        c.recentTimestamp,
        OJO_FALLBACK.checks.recentTimestamp,
      ),
    },
    prompt: typeof r.prompt === "string" ? r.prompt : OJO_FALLBACK.prompt,
  };
}

type GetResult =
  | { ok: true; config: OjoConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getOjoConfig(): Promise<GetResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-get-ojo-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalize(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}

type UpdateResult =
  | { ok: true; config: OjoConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateOjoConfig(config: OjoConfig): Promise<UpdateResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-update-ojo-config", {
    config,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalize(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}
