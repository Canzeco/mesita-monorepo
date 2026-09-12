"use client";

// ONE shared discovery-filter store for Feed and Scroll (MESITA-1792).
// Super Category · Places scope · Google review floor. Location is GPS,
// not persisted here. Module-level state + useSyncExternalStore.

import { useSyncExternalStore } from "react";
import {
  DISCOVERY_FILTER_DEFAULTS,
  clampReviewFloor,
  parsePlacesScope,
  type DiscoveryFilters,
  type DiscoveryPlacesScope,
  type DiscoveryReviewFloor,
} from "@/lib/discovery-filters-engine";
import { PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";

const STORAGE_KEY = "mesita_discovery_filters_v6";

const KNOWN_FAMILY_KEYS = new Set<string>(PLACE_FAMILIES.map((f) => f.key));

function readPersisted(): DiscoveryFilters {
  if (typeof window === "undefined") return DISCOVERY_FILTER_DEFAULTS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DISCOVERY_FILTER_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<
      Record<keyof DiscoveryFilters, unknown>
    >;
    return {
      familyKeys: Array.isArray(parsed.familyKeys)
        ? (parsed.familyKeys as unknown[]).filter(
            (k): k is FamilyKey =>
              typeof k === "string" && KNOWN_FAMILY_KEYS.has(k),
          )
        : [],
      placesScope: parsePlacesScope(parsed.placesScope),
      minReviews: clampReviewFloor(parsed.minReviews),
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

function patchDiscoveryFilters(partial: Partial<DiscoveryFilters>) {
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

export function setDiscoveryPlacesScope(placesScope: DiscoveryPlacesScope) {
  patchDiscoveryFilters({ placesScope });
}

export function setDiscoveryMinReviews(minReviews: DiscoveryReviewFloor) {
  patchDiscoveryFilters({ minReviews: clampReviewFloor(minReviews) });
}

export function useDiscoveryFilters(): DiscoveryFilters {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => DISCOVERY_FILTER_DEFAULTS,
  );
}
