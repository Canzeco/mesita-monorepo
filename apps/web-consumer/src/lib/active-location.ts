// Where Places searches from (MESITA-2401). The location button lives in
// Home's header, above every Home page, and Places reads it, so the choice
// is one small store rather than Places' own state. `null` = the guest's
// current location. Kept for this tab (sessionStorage), like the map filters.
//
// Only the KEY is kept (`saved:<id>`, MESITA-2501): the pin and its name are
// read from the saved list on every render, so an edit or a backfill moves
// the header and the catalog at once, and a removed or unconfirmed entry
// falls back to current location. A value an older build stored (with a
// name, coordinates or a rectangle) is read for its key only.

import { useMemo, useSyncExternalStore } from "react";
import { displayName, useSavedLocations, type SavedLocation } from "@/lib/saved-locations";

export type ActiveLocation = {
  /** `saved:<id>`. */
  key: string;
  name: string;
  lat: number;
  lng: number;
  /** The pin's own radius (km); null = the operator's (MESITA-2703). */
  radiusKm: number | null;
};

const STORAGE_KEY = "mesita:active-location";

type Listener = () => void;
const listeners = new Set<Listener>();
let state: string | null = null;
let hydrated = false;

export function savedLocationKey(id: string): string {
  return `saved:${id}`;
}

/** The stored key; an older build's object is read for its `key`. */
function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as unknown;
    if (typeof o === "string" && o.startsWith("saved:")) return o;
    if (o && typeof o === "object" && typeof (o as { key?: unknown }).key === "string") {
      const key = (o as { key: string }).key;
      return key.startsWith("saved:") ? key : null;
    }
  } catch {
    /* private mode or a broken value: current location */
  }
  return null;
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  state = read();
  hydrated = true;
}

/** Choose where Places searches from: a saved location's key, or `null` for
 *  current location. */
export function setActiveLocation(key: string | null): void {
  ensureHydrated();
  state = key;
  if (typeof window !== "undefined") {
    try {
      if (key) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(key));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* the choice still lives for this visit */
    }
  }
  for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
  ensureHydrated();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getActiveLocationKey(): string | null {
  ensureHydrated();
  return state;
}

function getServerSnapshot(): string | null {
  return null;
}

/** The active key against the saved list: the entry it names, or null when
 *  it names nothing usable (removed, or unconfirmed: an unconfirmed point
 *  never drives a search). */
export function resolveActiveLocation(
  key: string | null,
  saved: readonly SavedLocation[],
): ActiveLocation | null {
  if (!key) return null;
  const entry = saved.find((l) => savedLocationKey(l.id) === key);
  if (!entry || entry.unconfirmed) return null;
  return { key, name: displayName(entry), lat: entry.lat, lng: entry.lng, radiusKm: entry.radiusKm };
}

export function useActiveLocationKey(): string | null {
  return useSyncExternalStore(subscribe, getActiveLocationKey, getServerSnapshot);
}

export function useActiveLocation(): ActiveLocation | null {
  const key = useActiveLocationKey();
  const saved = useSavedLocations();
  const resolved = resolveActiveLocation(key, saved);
  // One object per (key, pin, name, radius), so effects keyed on it stay
  // quiet when nothing they read changed, and a radius edit alone refetches.
  const name = resolved?.name ?? null;
  const lat = resolved?.lat ?? null;
  const lng = resolved?.lng ?? null;
  const radiusKm = resolved?.radiusKm ?? null;
  return useMemo(
    () =>
      key && name !== null && lat !== null && lng !== null
        ? { key, name, lat, lng, radiusKm }
        : null,
    [key, name, lat, lng, radiusKm],
  );
}
