"use client";

// ONE shared discovery-filter store for every consumer surface (MESITA-646).
// Module-level state + useSyncExternalStore (the saved-places pattern): the
// Swipe deck, the Search map and both trigger dots read the SAME filters, so
// narrowing on one surface is narrowed everywhere — the two sheets can never
// disagree. Persisted to sessionStorage like the swipe snapshot. The server
// snapshot is always the defaults, so SSR HTML stays deterministic; React
// swaps in the persisted client snapshot right after hydration.

import { useSyncExternalStore } from "react";
import {
  DISCOVERY_FILTER_DEFAULTS,
  type DiscoveryFilters,
} from "@/lib/discovery-filters-engine";
import { PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";

const STORAGE_KEY = "mesita_discovery_filters_v1";

const KNOWN_FAMILY_KEYS = new Set<string>(PLACE_FAMILIES.map((f) => f.key));

function readPersisted(): DiscoveryFilters {
  if (typeof window === "undefined") return DISCOVERY_FILTER_DEFAULTS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return DISCOVERY_FILTER_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<DiscoveryFilters>;
    return {
      familyKeys: Array.isArray(parsed.familyKeys)
        ? parsed.familyKeys.filter(
            (k): k is FamilyKey =>
              typeof k === "string" && KNOWN_FAMILY_KEYS.has(k),
          )
        : [],
      zone: typeof parsed.zone === "string" ? parsed.zone : null,
      openNow: parsed.openNow === true,
      surprise: parsed.surprise === true,
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

export function useDiscoveryFilters(): DiscoveryFilters {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => DISCOVERY_FILTER_DEFAULTS,
  );
}
