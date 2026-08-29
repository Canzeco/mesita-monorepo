// Discovery mode × pool × module × signal matrix.
//
// SPEC MIRROR, NOT A DISPATCHER. Twin of admin
// `apps/web-admin/.../filters-config/catalog.ts` DISCOVERY_MODE_*. Change one,
// change the other. Vercel root is apps/web-admin so that bundle cannot import
// this file.
//
// Deep does not call Nearby Search. That cell is red. Guest pin bias on
// Autocomplete / Text Search / name match is not this API. Do not
// dispatch from modeCallsModule.

import {
  SIGNAL_KEYS,
  type SignalKey,
} from "./discovery-signals.ts";

export const DISCOVERY_MODE_KEYS = [
  "fast",
  "deep",
  "map",
  "swipe",
  "catalog",
  "chat",
  "social",
  "favorites",
] as const;

export type DiscoveryModeKey = (typeof DISCOVERY_MODE_KEYS)[number];

export const DISCOVERY_POOLS = [
  { key: "google", label: "Google Places" },
  { key: "listed", label: "Mesita Listed" },
  { key: "enriched", label: "Mesita Enriched" },
] as const;

export type DiscoveryPoolKey = (typeof DISCOVERY_POOLS)[number]["key"];

export const DISCOVERY_MODE_POOLS: Record<
  DiscoveryModeKey,
  readonly DiscoveryPoolKey[]
> = {
  fast: [],
  deep: [],
  map: [],
  swipe: ["google", "listed"],
  catalog: ["google", "listed"],
  chat: [],
  social: ["google", "listed"],
  favorites: ["google", "listed"],
};

export const DISCOVERY_MODULES = [
  "Google Places Autocomplete",
  "Google Places Text Search",
  "Google Places Nearby Search",
  "Perplexity Search",
  "Perplexity Agent",
  "Mesita Places Lineup",
  "Mesita Social Lineup",
] as const;

export const DISCOVERY_MODE_MODULES = {
  fast: ["Google Places Autocomplete"],
  deep: [
    "Google Places Autocomplete",
    "Google Places Text Search",
    "Mesita Places Lineup",
  ],
  map: ["Google Places Nearby Search", "Mesita Places Lineup"],
  swipe: ["Mesita Places Lineup"],
  catalog: ["Mesita Places Lineup"],
  chat: [
    "Google Places Text Search",
    "Google Places Nearby Search",
    "Perplexity Search",
    "Perplexity Agent",
    "Mesita Places Lineup",
  ],
  social: ["Mesita Social Lineup"],
  favorites: [],
} as const;

export const DISCOVERY_MODE_SIGNALS: Record<
  DiscoveryModeKey,
  readonly SignalKey[]
> = {
  fast: [],
  deep: ["name"],
  map: ["proximity", "timing", "category", "popularity", "partnership"],
  swipe: [
    "proximity",
    "timing",
    "category",
    "popularity",
    "partnership",
    "randomness",
  ],
  catalog: [
    "proximity",
    "timing",
    "category",
    "popularity",
    "partnership",
    "randomness",
  ],
  chat: [
    "name",
    "summary",
    "proximity",
    "timing",
    "category",
    "popularity",
    "partnership",
  ],
  social: [],
  favorites: [],
};

export const DISCOVERY_MODE_SIGNAL_ZERO: Partial<
  Record<DiscoveryModeKey, readonly SignalKey[]>
> = {
  map: ["randomness"],
};

export function modeRequiresPool(
  mode: DiscoveryModeKey,
  pool: DiscoveryPoolKey,
): boolean {
  return DISCOVERY_MODE_POOLS[mode].includes(pool);
}

export function modeCallsModule(mode: DiscoveryModeKey, module: string): boolean {
  return (DISCOVERY_MODE_MODULES[mode] as readonly string[]).includes(module);
}

export function modeSignalState(
  mode: DiscoveryModeKey,
  signal: SignalKey,
): "on" | "off" | "zero" {
  if (DISCOVERY_MODE_SIGNAL_ZERO[mode]?.includes(signal)) return "zero";
  if (DISCOVERY_MODE_SIGNALS[mode].includes(signal)) return "on";
  return "off";
}

/** Off and zero → exponent 0. On → stored weight. */
export function weightsForMode(
  mode: DiscoveryModeKey,
  global: Record<SignalKey, number>,
): Record<SignalKey, number> {
  const out = {} as Record<SignalKey, number>;
  for (const key of SIGNAL_KEYS) {
    const state = modeSignalState(mode, key);
    out[key] = state === "on" ? global[key] ?? 0 : 0;
  }
  return out;
}
