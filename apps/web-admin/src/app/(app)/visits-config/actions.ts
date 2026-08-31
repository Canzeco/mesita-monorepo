"use server";

// Server actions for Visits Config. Thin wrappers over the admin-web-* Edge
// Functions via the Result-style efInvoke (never throws). Backed by
// admin-web-get/update-visits-config on app_config.visits_config. WHOLE-BLOB
// save: the knobs are a related set — the preselected tip must be one of the
// offered presets, and the staff backoff ceiling can never sit below its base
// interval. No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { VISITS_FALLBACK, type VisitsConfig } from "./defaults";

type ConfigPayload = { config: unknown; updatedAt: string | null };

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

function presets(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [...VISITS_FALLBACK.tipPresets];
  const clean = [
    ...new Set(
      raw
        .map((v) => Math.round(num(v, NaN, 0, 100)))
        .filter((v) => Number.isFinite(v)),
    ),
  ]
    .sort((a, b) => a - b)
    .slice(0, 4);
  return clean.length ? clean : [...VISITS_FALLBACK.tipPresets];
}

// Mirrors supabase/functions/_shared/visits-config.ts — the EF is
// authoritative; this keeps the form honest if the blob is older than the
// current shape.
function normalize(raw: unknown): VisitsConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const tipPresets = presets(r.tipPresets);
  const staffPoll = Math.round(
    num(r.staffPollSeconds, VISITS_FALLBACK.staffPollSeconds, 1, 120),
  );
  const wantedDefault = Math.round(
    num(r.defaultTipPct, VISITS_FALLBACK.defaultTipPct, 0, 100),
  );
  return {
    tipEnabled: bool(r.tipEnabled, VISITS_FALLBACK.tipEnabled),
    tipPresets,
    defaultTipPct: tipPresets.includes(wantedDefault)
      ? wantedDefault
      : tipPresets[0],
    consumerPollSeconds: Math.round(
      num(r.consumerPollSeconds, VISITS_FALLBACK.consumerPollSeconds, 2, 120),
    ),
    staffPollSeconds: staffPoll,
    staffPollMaxSeconds: Math.max(
      staffPoll,
      Math.round(
        num(r.staffPollMaxSeconds, VISITS_FALLBACK.staffPollMaxSeconds, 1, 600),
      ),
    ),
    requireProofScreenshot: bool(
      r.requireProofScreenshot,
      VISITS_FALLBACK.requireProofScreenshot,
    ),
    maxFixRequests: Math.round(
      num(r.maxFixRequests, VISITS_FALLBACK.maxFixRequests, 0, 10),
    ),
    payCash: bool(r.payCash, VISITS_FALLBACK.payCash),
    payCard: bool(r.payCard, VISITS_FALLBACK.payCard),
    payCredits: bool(r.payCredits, VISITS_FALLBACK.payCredits),
    autoCloseHours: Math.round(
      num(r.autoCloseHours, VISITS_FALLBACK.autoCloseHours, 1, 720),
    ),
    legacyV3Enabled: bool(r.legacyV3Enabled, VISITS_FALLBACK.legacyV3Enabled),
    reportEnabled: bool(r.reportEnabled, VISITS_FALLBACK.reportEnabled),
  };
}

type GetResult =
  | { ok: true; config: VisitsConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getVisitsConfig(): Promise<GetResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-get-visits-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalize(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}

type UpdateResult =
  | { ok: true; config: VisitsConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateVisitsConfig(
  config: VisitsConfig,
): Promise<UpdateResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-update-visits-config", {
    config,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalize(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}
