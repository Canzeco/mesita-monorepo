// Discovery mode → signal mask, and `weightsForMode`.
//
// The engines read this file: each mode's signal mask (which Lineup signals it
// multiplies), the signals pinned to exponent 0, and the per-mode weight bag.
// The mode × entity × pool × source spec tables the console renders live in
// web-admin's `filters-config/discovery-matrix.ts`; Vercel's root is
// apps/web-admin, so that bundle cannot import this file, and the masks below
// are mirrored there by hand. Change one, change the other.
//
// A **Mode** is a guest Discovery surface (Notion Docs > Discovery section
// 8.1). Word is the searchbar, Map is the pins; Social left the mode list.

import {
  SIGNAL_KEYS,
  type SignalKey,
} from "./discovery-signals.ts";

export const DISCOVERY_MODE_KEYS = [
  "word",
  "map",
  "catalog",
  "swipe",
  "chat",
  "favorites",
] as const;

export type DiscoveryModeKey = (typeof DISCOVERY_MODE_KEYS)[number];

export const DISCOVERY_MODE_SIGNALS: Record<
  DiscoveryModeKey,
  readonly SignalKey[]
> = {
  word: ["name"],
  map: ["category", "proximity", "timing", "enriched", "popularity"],
  catalog: [
    "category",
    "proximity",
    "timing",
    "enriched",
    "popularity",
    "randomness",
  ],
  swipe: [
    "category",
    "proximity",
    "timing",
    "enriched",
    "popularity",
    "randomness",
  ],
  chat: [
    "name",
    "category",
    "proximity",
    "timing",
    "enriched",
    "popularity",
  ],
  favorites: [],
};

/**
 * ON THE MASK, PINNED TO EXPONENT 0. The signal is part of this mode's product,
 * but on THIS mode its exponent provably cannot reorder the result, so the
 * console renders a labelled em-dash, stores nothing, and `weightsForMode`
 * returns 0. Same rule as Word's missing column — a knob that changes nothing
 * is a knob that lies.
 *
 * map / randomness  Map is a pin field. A shuffled pin is a moved pin.
 */
export const DISCOVERY_MODE_SIGNAL_ZERO: Partial<
  Record<DiscoveryModeKey, readonly SignalKey[]>
> = {
  map: ["randomness"],
};

/**
 * THE MODES THAT EARN A WEIGHT COLUMN (MESITA-1859). A mode is here when BOTH
 * halves hold, and the contract test in discovery-matrix.test.ts asserts both:
 *
 *   1. some non-test file calls `weightsForMode` for it, and
 *   2. its mask carries MORE THAN ONE signal.
 *
 * Half 1 alone is wrong, and Word is why. Word calls `weightsForMode` twice
 * (consumer-search-lane.ts), so a caller-set rule would hand it a column — but
 * its mask is `["name"]`, and a one-factor product `s^w` is a monotone
 * transform of `s`. The exponent cannot reorder a Word result, so a column for
 * it would be a knob that provably changes nothing.
 *
 *   map     ranks only on the no-Google-fill branch (`willReorder` in
 *           consumer-web-list-places/index.ts) — CONDITIONALLY real, and the
 *           console card says so.
 *   swipe   always ranks. Every Scroll deck goes through it.
 *
 * Catalog ranks by cosine, Chat and Favorites have no engine, and Favorites'
 * mask is empty besides — none of them calls this function at all.
 */
export const WEIGHTED_MODE_KEYS = ["map", "swipe"] as const;

export type WeightedModeKey = (typeof WEIGHTED_MODE_KEYS)[number];

/** A stored per-mode exponent bag. Sparse: a missing key falls back. */
export type WeightsByMode = Partial<
  Record<DiscoveryModeKey, Partial<Record<SignalKey, number>>>
>;

export function modeSignalState(
  mode: DiscoveryModeKey,
  signal: SignalKey,
): "on" | "off" | "zero" {
  if (DISCOVERY_MODE_SIGNAL_ZERO[mode]?.includes(signal)) return "zero";
  if (DISCOVERY_MODE_SIGNALS[mode].includes(signal)) return "on";
  return "off";
}

/**
 * Off and zero → exponent 0. On → this mode's own weight, else the global one.
 *
 * THE MASK IS CONSULTED FIRST, ALWAYS (MESITA-1859). `DISCOVERY_MODE_SIGNALS`
 * and `DISCOVERY_MODE_SIGNAL_ZERO` are code law, not data: change the mask and
 * every mode re-zeros on the next deploy. Folding them into the stored blob
 * would let a persisted vector carry a non-zero weight for a signal
 * `modeSignalState` reports as "off" — the Matrix renders from
 * `modeSignalState`, so the console would say off while the engine multiplied
 * `s^w`.
 *
 * Reading the mask first also makes a missing mode key harmless: it falls back
 * to `global`, never to `undefined`. That matters more than it looks. A
 * missing key does NOT produce NaN — `discovery-blend.ts` short-circuits a
 * non-finite or non-positive exponent to OFF, so EVERY signal would turn off,
 * every place would score exactly 1, and the deck would silently fall back to
 * incoming order with nothing in any log.
 */
export function weightsForMode(
  mode: DiscoveryModeKey,
  global: Record<SignalKey, number>,
  byMode?: WeightsByMode,
): Record<SignalKey, number> {
  const out = {} as Record<SignalKey, number>;
  for (const key of SIGNAL_KEYS) {
    const state = modeSignalState(mode, key);
    out[key] = state === "on" ? byMode?.[mode]?.[key] ?? global[key] ?? 0 : 0;
  }
  return out;
}
