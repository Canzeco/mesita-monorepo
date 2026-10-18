// Where Places searches from (MESITA-2401). The location button lives in
// Home's header, above every Home page, and Places reads it, so the choice
// is one small store rather than Places' own state. `null` = the guest's
// current location. Kept for this tab (sessionStorage), like the map filters.

import { useSyncExternalStore } from "react";
import type { LocationBounds } from "@/lib/saved-locations";

export type ActiveLocation = {
  /** `saved:<id>` for a saved location. */
  key: string;
  name: string;
  lat: number;
  lng: number;
  bounds?: LocationBounds;
};

const STORAGE_KEY = "mesita:active-location";

type Listener = () => void;
const listeners = new Set<Listener>();
let state: ActiveLocation | null = null;
let hydrated = false;

function read(): ActiveLocation | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<ActiveLocation>;
    if (
      typeof o.key === "string" &&
      typeof o.name === "string" &&
      typeof o.lat === "number" &&
      Number.isFinite(o.lat) &&
      typeof o.lng === "number" &&
      Number.isFinite(o.lng)
    ) {
      return o as ActiveLocation;
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

/** Choose where Places searches from; `null` = current location. */
export function setActiveLocation(next: ActiveLocation | null): void {
  ensureHydrated();
  state = next;
  if (typeof window !== "undefined") {
    try {
      if (next) window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
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

function getSnapshot(): ActiveLocation | null {
  ensureHydrated();
  return state;
}

function getServerSnapshot(): ActiveLocation | null {
  return null;
}

export function useActiveLocation(): ActiveLocation | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
