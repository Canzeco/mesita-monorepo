// Saved locations — the guest's own named points (Home, Office…) that Places
// can search from (Pato, MESITA-2380: "no official Mesita zones, you just
// save them").
//
// Stored in this browser, the same way Favorites are (saved-places.ts): no
// EF, and consumer-local-reset.ts wipes them when a different guest signs in.
// The public API (list / add / remove) is the only thing to swap if a server
// store arrives.
//
// TWO KINDS (MESITA-2383): a `point` (Home, an address, where I stand) ranks
// by distance; an `area` (a city, a neighbourhood, a postcode) carries the
// Google viewport rectangle and ranks by inside/outside (MESITA-2379). An
// entry stored before kinds existed reads as a point. A zone drawn on a map
// is a later issue.

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "mesita:saved-locations";

/** Older entries drop off past this many. */
export const SAVED_LOCATIONS_MAX = 8;

export type LocationBounds = {
  low: { lat: number; lng: number };
  high: { lat: number; lng: number };
};

export type SavedLocation = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  kind: "point" | "area";
  /** The area's rectangle; present iff `kind` is "area". */
  bounds?: LocationBounds;
};

const finite = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v);

function isLatLng(x: unknown): x is { lat: number; lng: number } {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return finite(o.lat) && finite(o.lng);
}

/** A usable rectangle: both corners, low strictly below and west of high. */
export function isLocationBounds(x: unknown): x is LocationBounds {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    isLatLng(o.low) &&
    isLatLng(o.high) &&
    o.low.lat < o.high.lat &&
    o.low.lng < o.high.lng
  );
}

type Listener = () => void;

const EMPTY: readonly SavedLocation[] = [];
let cache: readonly SavedLocation[] = EMPTY;
let hydrated = false;
const listeners = new Set<Listener>();

/** A stored entry, upgraded: no kind (or a broken area) reads as a point. */
function toSavedLocation(x: unknown): SavedLocation | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.name !== "string") return null;
  if (!finite(o.lat) || !finite(o.lng)) return null;
  const base = { id: o.id, name: o.name, lat: o.lat, lng: o.lng };
  return o.kind === "area" && isLocationBounds(o.bounds)
    ? { ...base, kind: "area", bounds: o.bounds }
    : { ...base, kind: "point" };
}

function readFromStorage(): readonly SavedLocation[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return EMPTY;
    return arr
      .map(toSavedLocation)
      .filter((l): l is SavedLocation => l !== null)
      .slice(0, SAVED_LOCATIONS_MAX);
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

/** Newest first; a second save of the same name replaces the first. Valid
 *  `bounds` make an area; anything else is a point. */
export function addSavedLocation(loc: {
  name: string;
  lat: number;
  lng: number;
  bounds?: LocationBounds | null;
}): SavedLocation {
  ensureHydrated();
  const name = loc.name.trim().slice(0, 40) || "Saved location";
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const saved: SavedLocation = isLocationBounds(loc.bounds)
    ? { id, name, lat: loc.lat, lng: loc.lng, kind: "area", bounds: loc.bounds }
    : { id, name, lat: loc.lat, lng: loc.lng, kind: "point" };
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
