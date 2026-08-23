// Discovery config — the operator's half of the ranking model (Docs ›
// Discovery §A, MESITA-1196).
//
// Two things live here, and they are the two LANES:
//
//   weights    one exponent per earned signal. This is the whole "weights
//              table" the doc asks for — one row per signal, exponent editable.
//   slotting   the bought lane: whether promoting places get slots at all, and
//              how often. Not a weight, because it is not a signal.
//
// The vocabulary is CODE-DEFINED, the same contract as channels.ts and
// enrich-triggers.ts: the console edits numbers, never the list of signals.
// SIGNAL_KEYS in discovery-signals.ts is the list, and normalize() rebuilds
// the blob against it on every read and every write — so a signal added in
// code appears with its default, and a key left over from a retired one is
// dropped on the next save rather than lingering in jsonb forever.
//
// THIS BLOB DELIBERATELY DOES NOT INHERIT `filters_config`. That column was
// dropped in MESITA-1183 and its shape encoded the old six-filter-module model
// — a different question (what may a guest exclude) from this one (how is the
// remainder ordered). The teardown migration says as much in its own comment.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { SIGNAL_KEYS, type SignalKey } from "./discovery-signals.ts";

export type DiscoveryConfig = {
  weights: Record<SignalKey, number>;
  slotting: {
    enabled: boolean;
    everyNth: number;
  };
};

/**
 * An exponent's legal range. The ceiling is 4 because s^4 already drives
 * anything below 0.85 under a tenth — past that the signal is not "important",
 * it is a filter, and filters are not what this model is. The floor is 0,
 * which means OFF.
 */
export const WEIGHT_MIN = 0;
export const WEIGHT_MAX = 4;

/** Bought slots can never be denser than every other card. */
export const SLOT_MIN_EVERY_NTH = 2;
export const SLOT_MAX_EVERY_NTH = 50;

/**
 * Defaults: every earned signal at 1 — its own number, unmodified — except
 * Randomness, which ships at 0.35 so it softens into a tiebreak instead of
 * shuffling the deck. Starting flat is the honest position: nothing has been
 * measured yet, and a fabricated weighting would look like a finding.
 *
 * Slotting ships ENABLED at every 5th card. Zero would be a lie about the
 * business — places do buy strategies today — and shipping it off would make
 * the bought lane dead code nobody notices is broken.
 */
export const DISCOVERY_DEFAULTS: DiscoveryConfig = {
  weights: {
    proximity: 1,
    timing: 1,
    category: 1,
    popularity: 1,
    semantic: 1,
    randomness: 0.35,
  },
  slotting: {
    enabled: true,
    everyNth: 5,
  },
};

function num(raw: unknown, fallback: number, min: number, max: number): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function bool(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

/**
 * Tolerant read: any missing or invalid key falls back to its default, and the
 * weights map is rebuilt from SIGNAL_KEYS so the stored blob can never disagree
 * with the code about which signals exist.
 *
 * Exponents are rounded to two decimals. The admin field steps in 0.05 and a
 * float landing at 1.7000000000000002 would make the page permanently `dirty`
 * against its own saved value — the Save button would never settle.
 */
export function normalizeDiscoveryConfig(raw: unknown): DiscoveryConfig {
  const r = (raw ?? {}) as Record<string, unknown>;
  const rawWeights = (r.weights ?? {}) as Record<string, unknown>;
  const rawSlotting = (r.slotting ?? {}) as Record<string, unknown>;

  const weights = {} as Record<SignalKey, number>;
  for (const key of SIGNAL_KEYS) {
    const v = num(rawWeights[key], DISCOVERY_DEFAULTS.weights[key], WEIGHT_MIN, WEIGHT_MAX);
    weights[key] = Math.round(v * 100) / 100;
  }

  return {
    weights,
    slotting: {
      enabled: bool(rawSlotting.enabled, DISCOVERY_DEFAULTS.slotting.enabled),
      everyNth: Math.round(
        num(
          rawSlotting.everyNth,
          DISCOVERY_DEFAULTS.slotting.everyNth,
          SLOT_MIN_EVERY_NTH,
          SLOT_MAX_EVERY_NTH,
        ),
      ),
    },
  };
}

/**
 * Load the live config, or the defaults if the row cannot be read.
 *
 * An engine must never fail to serve a deck because a config read failed —
 * falling back to defaults degrades the ordering, while throwing would empty
 * the guest's screen. The read error is logged, not raised.
 */
export async function loadDiscoveryConfig(
  admin: SupabaseClient,
): Promise<DiscoveryConfig> {
  try {
    const { data, error } = await admin
      .from("app_config")
      .select("discovery_config")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      console.error("[discovery-config] read:", error.message);
      return DISCOVERY_DEFAULTS;
    }
    return normalizeDiscoveryConfig(data?.discovery_config);
  } catch (e) {
    console.error("[discovery-config] read threw:", (e as Error).message);
    return DISCOVERY_DEFAULTS;
  }
}
