"use client";

// Search-map filter store. Isolated from Discovery (Swipe): narrowing
// Places scope or Super Category on the map never touches the deck.

import { useSyncExternalStore } from "react";
import {
  clampResultLimit,
  MAP_FILTER_DEFAULTS,
  type MapFilters,
  type MapPlacesScope,
  type MapResultLimit,
  parsePlacesScope,
} from "@/lib/map-filters-engine";
import { PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";

// v5, because v4 holds `searchPower` as an ordinal under the two-set law
// and `1` meant "Mesita Places" there. Widening the parser instead of
// bumping the key would re-read that stored 1 under the new chain — the
// session would silently land on a narrower ring than the guest chose.
// sessionStorage, so the cost of the bump is one forgotten sheet state.
const STORAGE_KEY = "mesita_map_filters_v5";
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
      resultLimit: clampResultLimit(parsed.resultLimit),
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

export function setMapResultLimit(limit: MapResultLimit) {
  patchMapFilters({ resultLimit: clampResultLimit(limit) });
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
