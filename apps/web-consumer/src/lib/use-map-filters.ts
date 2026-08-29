"use client";

// Search-map filter store. Isolated from Discovery (Swipe): narrowing
// Status or Super Category on the map never touches the deck.

import { useSyncExternalStore } from "react";
import {
  MAP_FILTER_DEFAULTS,
  MAP_STATUS_KEYS,
  type MapFilters,
  type MapStatusKey,
} from "@/lib/map-filters-engine";
import { PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";

const STORAGE_KEY = "mesita_map_filters_v1";
const KNOWN_FAMILY_KEYS = new Set<string>(PLACE_FAMILIES.map((f) => f.key));
const KNOWN_STATUSES = new Set<string>(MAP_STATUS_KEYS);

function readPersisted(): MapFilters {
  if (typeof window === "undefined") return MAP_FILTER_DEFAULTS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return MAP_FILTER_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<
      Record<keyof MapFilters, unknown>
    >;
    return {
      statuses: Array.isArray(parsed.statuses)
        ? (parsed.statuses as unknown[]).filter(
            (k): k is MapStatusKey =>
              typeof k === "string" && KNOWN_STATUSES.has(k),
          )
        : [],
      familyKeys: Array.isArray(parsed.familyKeys)
        ? (parsed.familyKeys as unknown[]).filter(
            (k): k is FamilyKey =>
              typeof k === "string" && KNOWN_FAMILY_KEYS.has(k),
          )
        : [],
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

export function toggleMapStatus(key: MapStatusKey) {
  patchMapFilters({
    statuses: state.statuses.includes(key)
      ? state.statuses.filter((k) => k !== key)
      : [...state.statuses, key],
  });
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
