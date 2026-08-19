// Favorites store — AsyncStorage port of web lib/saved-places.ts.
// Saving is a BOOKMARK and nothing more — it issues no discount; a discount
// comes from showing up. Still localStorage-only, exactly like web.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'mesita:saved-places';
const PREVIEW_STORAGE_KEY = 'mesita:saved-place-previews';

type Listener = () => void;

let cache: ReadonlySet<string> = new Set();
let hydrated = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<Listener>();

function emit() {
  for (const l of listeners) l();
}

async function hydrate(): Promise<void> {
  if (hydrated) return;
  if (hydrating) return hydrating;
  hydrating = (async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const arr = JSON.parse(raw) as unknown;
        if (Array.isArray(arr)) {
          cache = new Set(arr.filter((x): x is string => typeof x === 'string'));
        }
      }
    } catch {
      /* degrade silently */
    } finally {
      hydrated = true;
      hydrating = null;
      emit();
    }
  })();
  return hydrating;
}

function writeToStorage(set: ReadonlySet<string>) {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...set])).catch(
    () => undefined,
  );
}

function subscribe(listener: Listener): () => void {
  void hydrate();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): ReadonlySet<string> {
  return cache;
}

// Whether the AsyncStorage read has landed yet, as a subscribable value.
//
// Load-bearing for empty states: hydration is async, so the cache is empty on
// first paint and any surface branching on `savedIds.size === 0` flashes its
// "nothing saved" state to every consumer who actually HAS saves. Branch on
// `hydrated` first and show a skeleton until it flips. hydrate() emit()s in its
// finally block, so the false → true transition always re-renders.
// Mirrors web lib/saved-places.ts.
function getHydratedSnapshot(): boolean {
  return hydrated;
}

function setPlaceSaved(placeId: string, saved: boolean): void {
  void hydrate().then(() => {
    const has = cache.has(placeId);
    if (has === saved) return;
    const next = new Set(cache);
    if (saved) next.add(placeId);
    else next.delete(placeId);
    cache = next;
    writeToStorage(cache);
    emit();
  });
}

export function upsertSavedPlacePreview<T extends { id: string }>(
  place: T,
): void {
  void (async () => {
    try {
      const raw = await AsyncStorage.getItem(PREVIEW_STORAGE_KEY);
      const parsed =
        raw != null ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const obj =
        parsed && typeof parsed === 'object' && !Array.isArray(parsed)
          ? parsed
          : {};
      obj[place.id] = place;
      await AsyncStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(obj));
    } catch {
      /* degrade silently */
    }
  })();
}

export async function readSavedPlacePreviews<
  T extends { id: string },
>(): Promise<Map<string, T>> {
  try {
    const raw = await AsyncStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return new Map();
    }
    const map = new Map<string, T>();
    for (const [id, value] of Object.entries(parsed)) {
      if (value && typeof value === 'object') {
        map.set(id, value as T);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

export function removeSavedPlacePreview(placeId: string): void {
  void (async () => {
    try {
      const map = await readSavedPlacePreviews<{ id: string }>();
      if (!map.delete(placeId)) return;
      const obj = Object.fromEntries(map.entries());
      await AsyncStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(obj));
    } catch {
      /* degrade silently */
    }
  })();
}

export function useSavedPlaces() {
  // Kick hydration on first hook mount so AsyncStorage loads before paints settle.
  useEffect(() => {
    void hydrate();
  }, []);

  const savedIds = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // `false` until the AsyncStorage read lands. Gate empty states on this or
  // they flash to everyone who has saves — see getHydratedSnapshot above.
  const hydrated = useSyncExternalStore(
    subscribe,
    getHydratedSnapshot,
    getHydratedSnapshot,
  );
  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);
  const setSaved = useCallback(
    (id: string, saved: boolean) => setPlaceSaved(id, saved),
    [],
  );
  return { savedIds, hydrated, isSaved, setSaved };
}
