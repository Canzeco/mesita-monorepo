// Discovery config — the operator's half of the ranking model (Docs ›
// Discovery §A, MESITA-1196).
//
// FOUR things live here, and they are the four boxes on the one Discovery page
// (Pato, 2026-08-23: "Signals, Engines, Filters. BUT NOT SUBPAGES. JUST ONE
// PAGE FOR ALL DISCOVERY. PERHAPS DIVIDE INTO BOXES."):
//
//   weights    one exponent per earned signal. This is the whole "weights
//              table" the doc asks for — one row per signal, exponent editable.
//   slotting   the bought lane: whether promoting places get slots at all, and
//              how often. Not a weight, because it is not a signal.
//   filters    what may ENTER the pool at all. The counterpart to a signal, and
//              the distinction is the whole reason both exist: a SIGNAL
//              DEMOTES, a FILTER EXCLUDES. A signal can only ever reorder
//              places a filter already admitted.
//   engines    which surfaces read any of the above.
//
// FILTERS ARE NOT THE TORN-DOWN FILTER SURFACE. MESITA-1183 deleted a
// GUEST-facing one — "what may a guest exclude" — and that tombstone stands.
// These are OPERATOR pool policy: catalog-wide admission rules a guest never
// sees and cannot express. Different question, different owner, and the old
// blob is deliberately not inherited (see the note at the bottom).
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
  filters: DiscoveryFilters;
  engines: Record<WiredEngineKey, { ranked: boolean }>;
};

/**
 * Pool admission. EVERY ONE OF THESE MUST BE EXPRESSIBLE AS A QUERY PREDICATE.
 *
 * That is not a style preference. The pool is capped at POOL_CAP before
 * anything ranks, so a filter applied AFTER the fetch does not narrow the
 * catalog — it thins the page the guest actually receives, silently, and the
 * deck gets shorter instead of better. Anything that cannot be pushed into the
 * WHERE clause does not belong in this box.
 */
export type DiscoveryFilters = {
  /** `content_status = 'ready'` — the enrichment gate MESITA-1228 hardcoded. */
  requireReady: boolean;
  /** Google stars floor. 0 = off. Above 0 EXCLUDES unrated places — see below. */
  minRating: number;
  /** Google review-count floor. 0 = off. */
  minReviews: number;
  /** Hard radius in km. 0 = off, and off is the default — see below. */
  maxDistanceKm: number;
};

/**
 * Engines that actually read the signal library today. CODE-DEFINED: an engine
 * only earns a key here when it is wired, so the console can never offer a
 * toggle over an engine that would ignore it.
 */
export const WIRED_ENGINE_KEYS = ["swipe"] as const;
export type WiredEngineKey = (typeof WIRED_ENGINE_KEYS)[number];

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

export const MIN_RATING_MAX = 5;
/** A radius past this is not a filter, it is the whole catalog. */
export const MAX_DISTANCE_KM_MAX = 200;

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
  /**
   * `requireReady` ships ON because it is already the shipped behaviour —
   * MESITA-1228 hardcoded it into Map and Swipe. Adopting a live gate at its
   * current value is the only default that changes nothing on landing.
   *
   * The quality floors ship OFF. Popularity already DEMOTES a weak place, and
   * a floor on top of it would delete the same place twice over — the reason
   * the two boxes are separate is that an operator should choose which one
   * they mean. They also exclude places with NO rating at all, which in a
   * young catalog is most of them.
   *
   * `maxDistanceKm` ships OFF for the same reason, and one more: Proximity
   * already bends distance through a log curve, so a hard radius is the model
   * MESITA-1183 tore down. It exists for the operator who genuinely wants a
   * city boundary, not as the default way distance is handled.
   */
  filters: {
    requireReady: true,
    minRating: 0,
    minReviews: 0,
    maxDistanceKm: 0,
  },
  engines: {
    swipe: { ranked: true },
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

  const rawFilters = (r.filters ?? {}) as Record<string, unknown>;
  const rawEngines = (r.engines ?? {}) as Record<string, unknown>;

  const engines = {} as Record<WiredEngineKey, { ranked: boolean }>;
  for (const key of WIRED_ENGINE_KEYS) {
    const e = (rawEngines[key] ?? {}) as Record<string, unknown>;
    engines[key] = { ranked: bool(e.ranked, DISCOVERY_DEFAULTS.engines[key].ranked) };
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
    filters: {
      requireReady: bool(rawFilters.requireReady, DISCOVERY_DEFAULTS.filters.requireReady),
      // Rounded to one decimal: Google stars are one-decimal values, and a
      // floor of 4.300000000000001 would leave the page permanently dirty.
      minRating: Math.round(
        num(rawFilters.minRating, DISCOVERY_DEFAULTS.filters.minRating, 0, MIN_RATING_MAX) * 10,
      ) / 10,
      minReviews: Math.round(
        num(rawFilters.minReviews, DISCOVERY_DEFAULTS.filters.minReviews, 0, 100_000),
      ),
      maxDistanceKm: Math.round(
        num(
          rawFilters.maxDistanceKm,
          DISCOVERY_DEFAULTS.filters.maxDistanceKm,
          0,
          MAX_DISTANCE_KM_MAX,
        ),
      ),
    },
    engines,
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
