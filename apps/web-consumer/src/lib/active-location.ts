// Where Places searches from (MESITA-2401). The location button lives in
// Home's header, above every Home page, and Places reads it, so the choice
// is one small store rather than Places' own state. `null` = the guest's
// current location. Kept for this tab (sessionStorage), like the map filters.
//
// REMEMBERED ACROSS VISITS (MESITA-4558): the last choice is also kept in
// localStorage, and stands in only when this tab chose nothing and the device
// gave no location. A live fix wins over it; "Use my location" forgets it.
//
// Only the KEY is kept (`saved:<id>`, MESITA-2501): the pin and its name are
// read from the saved list on every render, so an edit or a backfill moves
// the header and the catalog at once, and a removed or unconfirmed entry
// falls back to current location. A value an older build stored (with a
// name, coordinates or a rectangle) is read for its key only.

import { useMemo, useSyncExternalStore } from "react";
import { useNoDeviceFix } from "@/lib/use-user-location";
import { displayName, useSavedLocations, type SavedLocation } from "@/lib/saved-locations";

export type ActiveLocation = {
  /** `saved:<id>`. */
  key: string;
  name: string;
  lat: number;
  lng: number;
};

const STORAGE_KEY = "mesita:active-location";
const REMEMBERED_KEY = "mesita:remembered-location";

type Listener = () => void;
const listeners = new Set<Listener>();
let state: string | null = null;
let remembered: string | null = null;
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

function readRemembered(): string | null {
  try {
    const key = window.localStorage.getItem(REMEMBERED_KEY);
    return key?.startsWith("saved:") ? key : null;
  } catch {
    return null;
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  state = read();
  remembered = readRemembered();
  hydrated = true;
}

/** Choose where Places searches from: a saved location's key, or `null` for
 *  current location. */
export function setActiveLocation(key: string | null): void {
  ensureHydrated();
  state = key;
  remembered = key;
  if (typeof window !== "undefined") {
    try {
      if (key) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(key));
      else window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* the choice still lives for this visit */
    }
  }
  if (typeof window !== "undefined") {
    try {
      if (key) window.localStorage.setItem(REMEMBERED_KEY, key);
      else window.localStorage.removeItem(REMEMBERED_KEY);
    } catch {
      /* not remembered past this tab */
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

function getRememberedKey(): string | null {
  ensureHydrated();
  return remembered;
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
  return { key, name: displayName(entry), lat: entry.lat, lng: entry.lng };
}

export function useActiveLocationKey(): string | null {
  const chosen = useSyncExternalStore(subscribe, getActiveLocationKey, getServerSnapshot);
  const last = useSyncExternalStore(subscribe, getRememberedKey, getServerSnapshot);
  const noFix = useNoDeviceFix();
  return chosen ?? (noFix ? last : null);
}

export function useActiveLocation(): ActiveLocation | null {
  const key = useActiveLocationKey();
  const saved = useSavedLocations();
  const resolved = resolveActiveLocation(key, saved);
  // One object per (key, pin, name), so effects keyed on it stay quiet when
  // nothing they read changed.
  const name = resolved?.name ?? null;
  const lat = resolved?.lat ?? null;
  const lng = resolved?.lng ?? null;
  return useMemo(
    () =>
      key && name !== null && lat !== null && lng !== null
        ? { key, name, lat, lng }
        : null,
    [key, name, lat, lng],
  );
}
