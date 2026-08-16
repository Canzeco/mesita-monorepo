"use client";

// Host context for the routed /filters modal (MESITA-905). Swipe + Catalog +
// Search publish live count / category options / geolocation availability; the
// route modal has no parent props, so it reads this module store. Cold open of
// /filters may see empty host until a discovery surface mounts — CTA falls
// back to "Done".

import { useSyncExternalStore } from "react";
import type { CategoryOption } from "@/lib/discovery-filters-engine";

type FiltersHostSurface = "swipe" | "catalog" | "search";

type FiltersHostContext = {
  count: number | null;
  categoryOptions: CategoryOption[];
  hasLocation: boolean;
  surface: FiltersHostSurface | null;
};

const EMPTY: FiltersHostContext = {
  count: null,
  categoryOptions: [],
  hasLocation: false,
  surface: null,
};

let state: FiltersHostContext = EMPTY;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function publishFiltersHostContext(
  next: Omit<FiltersHostContext, "surface"> & { surface: FiltersHostSurface },
) {
  state = next;
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
  return EMPTY;
}

export function useFiltersHostContext(): FiltersHostContext {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
