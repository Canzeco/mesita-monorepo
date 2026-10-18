// Saved locations — the guest's own named points (Home, Office…) that Places
// can search from (Pato, MESITA-2380: "no official Mesita zones, you just
// save them").
//
// Stored in this browser, the same way Favorites are (saved-places.ts): no
// EF, and consumer-local-reset.ts wipes them when a different guest signs in.
// The public API (list / add / remove) is the only thing to swap if a server
// store arrives. A zone drawn on a map is the other half of MESITA-2380 and
// waits on the merged feed (MESITA-2379); this store holds points only.

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "mesita:saved-locations";

/** Older entries drop off past this many. */
export const SAVED_LOCATIONS_MAX = 8;

export type SavedLocation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
};

type Listener = () => void;

const EMPTY: readonly SavedLocation[] = [];
let cache: readonly SavedLocation[] = EMPTY;
let hydrated = false;
const listeners = new Set<Listener>();

function isSavedLocation(x: unknown): x is SavedLocation {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.name === "string" &&
    typeof o.lat === "number" &&
    Number.isFinite(o.lat) &&
    typeof o.lng === "number" &&
    Number.isFinite(o.lng)
  );
}

function readFromStorage(): readonly SavedLocation[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return EMPTY;
    return arr.filter(isSavedLocation).slice(0, SAVED_LOCATIONS_MAX);
  } catch {
    return EMPTY;
  }
}

function write(next: readonly SavedLocation[]) {
  cache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* quota / private mode — the list still lives for this visit */
    }
  }
  for (const l of listeners) l();
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  cache = readFromStorage();
  hydrated = true;
}

function subscribe(listener: Listener): () => void {
  ensureHydrated();
  listeners.add(listener);
  function onStorage(e: StorageEvent) {
    if (e.key !== STORAGE_KEY) return;
    cache = readFromStorage();
    for (const l of listeners) l();
  }
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): readonly SavedLocation[] {
  ensureHydrated();
  return cache;
}

function getServerSnapshot(): readonly SavedLocation[] {
  return EMPTY;
}

/** Newest first; a second save of the same name replaces the first. */
export function addSavedLocation(
  loc: Omit<SavedLocation, "id">,
): SavedLocation {
  ensureHydrated();
  const name = loc.name.trim().slice(0, 40) || "Saved location";
  const saved: SavedLocation = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    lat: loc.lat,
    lng: loc.lng,
  };
  const rest = cache.filter(
    (l) => l.name.toLowerCase() !== name.toLowerCase(),
  );
  write([saved, ...rest].slice(0, SAVED_LOCATIONS_MAX));
  return saved;
}

export function removeSavedLocation(id: string): void {
  ensureHydrated();
  if (!cache.some((l) => l.id === id)) return;
  write(cache.filter((l) => l.id !== id));
}

/** Called by consumer-local-reset.ts when the signed-in guest changes. */
export function clearSavedLocationsLocal(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode — nothing to clear */
    }
  }
  cache = EMPTY;
  hydrated = true;
  for (const l of listeners) l();
}

export function useSavedLocations(): readonly SavedLocation[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
