"use client";

// Search-map filter store: the family chips, All or one family. A persisted
// v6 blob's `placesScope` (MESITA-2298) and `minReviews` (MESITA-2417, the
// operator's now) are ignored.

import { useSyncExternalStore } from "react";
import { MAP_FILTER_DEFAULTS, type MapFilters } from "@/lib/map-filters-engine";
import { FILTERABLE_PLACE_FAMILIES, type FamilyKey } from "@/lib/place-families";

// v6: v5 held `resultLimit` (How many). That stop is operator
// the operator's source switches (MESITA-2703) again; this key holds Family, Places scope and
// Popularity. Bumping rather than widening the parser drops a forgotten
// How many from a v5 session instead of pretending it is still a guest
// knob. sessionStorage, so the cost of the bump is one forgotten sheet state.
const STORAGE_KEY = "mesita_map_filters_v6";
// Hydrate from the FILTERABLE twenty, never `undefined`.
// A persisted key the sheet no longer renders is a filter the guest cannot
// see or clear (MESITA-1857).
const KNOWN_FAMILY_KEYS = new Set<string>(
  FILTERABLE_PLACE_FAMILIES.map((f) => f.key),
);

function readPersisted(): MapFilters {
  if (typeof window === "undefined") return MAP_FILTER_DEFAULTS;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return MAP_FILTER_DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<
      Record<keyof MapFilters, unknown>
    >;
    return {
      familyKeys: Array.isArray(parsed.familyKeys)
        ? (parsed.familyKeys as unknown[]).filter(
            (k): k is FamilyKey =>
              typeof k === "string" && KNOWN_FAMILY_KEYS.has(k),
          ).slice(0, 1)
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

/** ONE family at a time, or All (Pato, MESITA-2412: "only enable to select
 *  one family at any time (or All)"). Picking the chosen one again is All. */
export function selectMapFamily(key: FamilyKey) {
  patchMapFilters({
    familyKeys: state.familyKeys.length === 1 && state.familyKeys[0] === key ? [] : [key],
  });
}

/** All Families: no family cut at all, the default (MESITA-2298). */
export function clearMapFamilies() {
  patchMapFilters({ familyKeys: [] });
}

export function useMapFilters(): MapFilters {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => MAP_FILTER_DEFAULTS,
  );
}
