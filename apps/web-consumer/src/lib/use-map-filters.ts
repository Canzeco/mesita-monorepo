"use client";

// Search-map filter store. Isolated from Discovery (Swipe): narrowing
// Places scope, Super Category or Popularity on the map never touches
// the deck.

import { useSyncExternalStore } from "react";
import {
  clampMinReviews,
  MAP_FILTER_DEFAULTS,
  type MapFilters,
  type MapMinReviews,
  type MapPlacesScope,
  parsePlacesScope,
} from "@/lib/map-filters-engine";
import { PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";

// v6: v5 held `resultLimit` (How many). That stop is operator
// `map.pinCount` again; this key holds Super Category, Places scope and
// Popularity. Bumping rather than widening the parser drops a forgotten
// How many from a v5 session instead of pretending it is still a guest
// knob. sessionStorage, so the cost of the bump is one forgotten sheet state.
const STORAGE_KEY = "mesita_map_filters_v6";
const KNOWN_FAMILY_KEYS = new Set<string>(PLACE_FAMILIES.map((f) => f.key));

function readPersisted(): MapFilters {
  if (typeof window === "undefined") return MAP_FILTER_DEFAULTS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return MAP_FILTER_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<
      Record<keyof MapFilters, unknown>
    >;
    return {
      placesScope: parsePlacesScope(parsed.placesScope),
      familyKeys: Array.isArray(parsed.familyKeys)
        ? (parsed.familyKeys as unknown[]).filter(
            (k): k is FamilyKey =>
              typeof k === "string" && KNOWN_FAMILY_KEYS.has(k),
          )
        : [],
      minReviews: clampMinReviews(parsed.minReviews),
    };
  } catch {
    return MAP_FILTER_DEFAULTS;
  }
}

let state: MapFilters = readPersisted();
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

function patchMapFilters(partial: Partial<MapFilters>) {
  state = { ...state, ...partial };
  persist();
  emit();
}

export function resetMapFilters() {
  state = MAP_FILTER_DEFAULTS;
  persist();
  emit();
}

export function setMapPlacesScope(scope: MapPlacesScope) {
  patchMapFilters({ placesScope: parsePlacesScope(scope) });
}

export function setMapMinReviews(minReviews: MapMinReviews) {
  patchMapFilters({ minReviews: clampMinReviews(minReviews) });
}

export function toggleMapFamily(key: FamilyKey) {
  patchMapFilters({
    familyKeys: state.familyKeys.includes(key)
      ? state.familyKeys.filter((k) => k !== key)
      : [...state.familyKeys, key],
  });
}

export function useMapFilters(): MapFilters {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => MAP_FILTER_DEFAULTS,
  );
}
