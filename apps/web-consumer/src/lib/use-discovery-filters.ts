"use client";

// ONE shared discovery-filter store for every consumer surface (MESITA-646,
// v3 schema MESITA-650). Module-level state + useSyncExternalStore (the
// saved-places pattern): the Swipe deck, the Search map and both trigger dots
// read the SAME filters, so narrowing on one surface is narrowed everywhere.
// Persisted to sessionStorage like the swipe snapshot. The server snapshot is
// always the defaults, so SSR HTML stays deterministic; React swaps in the
// persisted client snapshot right after hydration.

import { useSyncExternalStore } from "react";
import {
  DISCOVERY_FILTER_DEFAULTS,
  DISTANCE_STEPS_KM,
  type DiscoveryFilters,
  type RandomnessLevel,
} from "@/lib/discovery-filters-engine";
import { PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";

// v2: the MESITA-650 shape (two-tier what/where, hour, randomness level).
// Old v1 keys are simply ignored — session-scoped state needs no migration.
const STORAGE_KEY = "mesita_discovery_filters_v2";

const KNOWN_FAMILY_KEYS = new Set<string>(PLACE_FAMILIES.map((f) => f.key));

function readPersisted(): DiscoveryFilters {
  if (typeof window === "undefined") return DISCOVERY_FILTER_DEFAULTS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DISCOVERY_FILTER_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DiscoveryFilters>;
    const hour =
      typeof parsed.hour === "number" && Number.isInteger(parsed.hour)
        ? Math.min(Math.max(parsed.hour, 0), 23)
        : null;
    const maxKm = (DISTANCE_STEPS_KM as readonly number[]).includes(
      parsed.maxKm as number,
    )
      ? (parsed.maxKm as number)
      : null;
    const randomness = ([0, 1, 2, 3] as const).includes(
      parsed.randomness as RandomnessLevel,
    )
      ? (parsed.randomness as RandomnessLevel)
      : 0;
    return {
      familyKeys: Array.isArray(parsed.familyKeys)
        ? parsed.familyKeys.filter(
            (k): k is FamilyKey =>
              typeof k === "string" && KNOWN_FAMILY_KEYS.has(k),
          )
        : [],
      categories: Array.isArray(parsed.categories)
        ? parsed.categories.filter(
            (c): c is string => typeof c === "string" && c.trim().length > 0,
          )
        : [],
      city: typeof parsed.city === "string" ? parsed.city : null,
      zone: typeof parsed.zone === "string" ? parsed.zone : null,
      maxKm,
      hour,
      randomness,
    };
  } catch {
    return DISCOVERY_FILTER_DEFAULTS;
  }
}

let state: DiscoveryFilters = readPersisted();
const listeners = new Set<() => void>();

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage failures
  }
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function patchDiscoveryFilters(partial: Partial<DiscoveryFilters>) {
  state = { ...state, ...partial };
  persist();
  emit();
}

export function resetDiscoveryFilters() {
  state = DISCOVERY_FILTER_DEFAULTS;
  persist();
  emit();
}

export function toggleDiscoveryFamily(key: FamilyKey) {
  patchDiscoveryFilters({
    familyKeys: state.familyKeys.includes(key)
      ? state.familyKeys.filter((k) => k !== key)
      : [...state.familyKeys, key],
  });
}

export function toggleDiscoveryCategory(slug: string) {
  patchDiscoveryFilters({
    categories: state.categories.includes(slug)
      ? state.categories.filter((c) => c !== slug)
      : [...state.categories, slug],
  });
}

export function useDiscoveryFilters(): DiscoveryFilters {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => DISCOVERY_FILTER_DEFAULTS,
  );
}
