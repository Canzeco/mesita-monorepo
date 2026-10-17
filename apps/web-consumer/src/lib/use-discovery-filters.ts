"use client";

// Catalog filter store. The two Mesita rings. Location is GPS, not
// persisted here. A stored family selection and a stored review floor
// are dropped: family is a carousel, and the review floor is the map's.

import { useSyncExternalStore } from "react";
import {
  DISCOVERY_FILTER_DEFAULTS,
  parsePlacesScope,
  type DiscoveryFilters,
  type DiscoveryPlacesScope,
} from "@/lib/discovery-filters-engine";

const STORAGE_KEY = "mesita_discovery_filters_v7";

function readPersisted(): DiscoveryFilters {
  if (typeof window === "undefined") return DISCOVERY_FILTER_DEFAULTS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DISCOVERY_FILTER_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<
      Record<keyof DiscoveryFilters, unknown>
    >;
    return {
      familyKeys: [],
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
