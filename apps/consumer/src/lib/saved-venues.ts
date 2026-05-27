// Saved-venues store. Persists which venue ids the consumer has bookmarked
// to localStorage so the state survives reloads. Module-scope state +
// useSyncExternalStore is the canonical React 18+ pattern for "subscribe
// to a value outside React" without the setState-in-useEffect anti-pattern.
//
// When the real backend lands this module is the only thing to swap: the
// public API (isSaved / toggleSaved / list) becomes an EF call instead of
// a localStorage read, and every caller keeps working unchanged.

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "mesita:saved-venues";

type Listener = () => void;

// Cache holds a frozen Set reference. Mutations replace the reference so
// useSyncExternalStore detects the change — Set mutation in-place would
// keep returning the same reference and React would skip the re-render.
let cache: ReadonlySet<string> = new Set();
let hydrated = false;
const listeners = new Set<Listener>();

function readFromStorage(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

function writeToStorage(set: ReadonlySet<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    /* quota / private mode — degrade silently */
  }
}

function ensureHydrated() {
  if (hydrated || typeof window === "undefined") return;
  cache = readFromStorage();
  hydrated = true;
}

function emit() {
  for (const l of listeners) l();
}

function subscribe(listener: Listener): () => void {
  ensureHydrated();
  listeners.add(listener);
  // Cross-tab sync: a save in tab B should reflect in tab A.
  function onStorage(e: StorageEvent) {
    if (e.key !== STORAGE_KEY) return;
    cache = readFromStorage();
    emit();
  }
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): ReadonlySet<string> {
  ensureHydrated();
  return cache;
}

function getServerSnapshot(): ReadonlySet<string> {
  // Empty set on the server so SSR + first client paint match. The real
  // saved set hydrates in after mount via subscribe → cache read.
  return EMPTY;
}

const EMPTY: ReadonlySet<string> = new Set();

function toggleSavedVenue(venueId: string): boolean {
  ensureHydrated();
  const next = new Set(cache);
  let nowSaved: boolean;
  if (next.has(venueId)) {
    next.delete(venueId);
    nowSaved = false;
  } else {
    next.add(venueId);
    nowSaved = true;
  }
  cache = next;
  writeToStorage(cache);
  emit();
  return nowSaved;
}

function setVenueSaved(venueId: string, saved: boolean): void {
  ensureHydrated();
  const has = cache.has(venueId);
  if (has === saved) return;
  const next = new Set(cache);
  if (saved) next.add(venueId);
  else next.delete(venueId);
  cache = next;
  writeToStorage(cache);
  emit();
}

// React hook — returns the live set + helpers. Re-renders whenever any
// caller mutates the store via toggleSavedVenue / setVenueSaved.
export function useSavedVenues() {
  const savedIds = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const isSaved = useCallback(
    (id: string) => savedIds.has(id),
    [savedIds],
  );
  const toggle = useCallback((id: string) => toggleSavedVenue(id), []);
  const setSaved = useCallback(
    (id: string, saved: boolean) => setVenueSaved(id, saved),
    [],
  );
  return { savedIds, isSaved, toggle, setSaved };
}
