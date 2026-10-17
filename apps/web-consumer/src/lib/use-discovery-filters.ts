"use client";

// Catalog filter store. Family and the two Mesita rings. Location is GPS,
// not persisted here. A stored Google review floor is dropped: that cut
// belongs to the map. Module-level state + useSyncExternalStore.

import { useSyncExternalStore } from "react";
import {
  DISCOVERY_FILTER_DEFAULTS,
  parsePlacesScope,
  type DiscoveryFilters,
  type DiscoveryPlacesScope,
} from "@/lib/discovery-filters-engine";
import { FILTERABLE_PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";

const STORAGE_KEY = "mesita_discovery_filters_v7";

// Hydrate from the FILTERABLE seven, not all eight.
// A persisted key the sheet no longer renders is a filter the guest cannot
// see or clear (MESITA-1857).
const KNOWN_FAMILY_KEYS = new Set<string>(
  FILTERABLE_PLACE_FAMILIES.map((f) => f.key),
);

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
      minReviews: 0,
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

export function useDiscoveryFilters(): DiscoveryFilters {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => DISCOVERY_FILTER_DEFAULTS,
  );
}
