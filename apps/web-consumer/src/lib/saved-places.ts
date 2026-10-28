// Favorites store. Persists which place ids the consumer has bookmarked
// to localStorage so the state survives reloads. Module-scope state +
// useSyncExternalStore is the canonical React 18+ pattern for "subscribe
// to a value outside React" without the setState-in-useEffect anti-pattern.
//
// Saving is a BOOKMARK, and since Social v1 (MESITA-2442) the server holds it:
// a `saved` row in place_activity. This browser's set is a CACHE: a toggle
// paints at once and writes through the remote sink (setSavedPlacesRemote,
// wired by ConsumerLocalDataGuard), and syncSavedPlaces() adopts the server's
// set on every shell mount. A Google-only card (`g:<id>`) has no place row
// yet, so its save stays local only.

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "mesita:saved-places";
const PREVIEW_STORAGE_KEY = "mesita:saved-place-previews";
// Set once this browser's pre-server saves were pushed up (MESITA-2442).
const SYNCED_KEY = "mesita:saved-places-synced";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where a save is written through. Null until the shell wires it. */
type SavedRemote = (placeId: string, saved: boolean) => void;
let remote: SavedRemote | null = null;

export function setSavedPlacesRemote(fn: SavedRemote | null): void {
  remote = fn;
}

function writeThrough(placeId: string, saved: boolean) {
  if (remote && UUID_RE.test(placeId)) remote(placeId, saved);
}

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

// Whether the localStorage read has happened yet, as a subscribable value.
//
// Load-bearing for empty states: because getServerSnapshot() is an empty set
// BY DESIGN (SSR and first client paint must agree), any surface that branches
// on `savedIds.size === 0` paints its "nothing saved" state for one frame to
// every consumer who actually has saves. Branch on `hydrated` first and show a
// skeleton until it flips.
//
// The flip is driven by subscribe(): React re-reads every snapshot right after
// subscribing, and subscribe() calls ensureHydrated() before returning — so
// the false → true transition always produces exactly one re-render.
function getHydratedSnapshot(): boolean {
  ensureHydrated();
  return hydrated;
}

function getHydratedServerSnapshot(): boolean {
  return false;
}

function readPreviewStorage<T extends { id: string }>(): Map<string, T> {
  if (typeof window === "undefined") return new Map();
  try {
    const raw = window.localStorage.getItem(PREVIEW_STORAGE_KEY);
    if (!raw) return new Map();
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return new Map();
    }
    const map = new Map<string, T>();
    for (const [id, value] of Object.entries(parsed)) {
      if (value && typeof value === "object") {
        map.set(id, value as T);
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

function writePreviewStorage<T extends { id: string }>(map: Map<string, T>) {
  if (typeof window === "undefined") return;
  try {
    const obj = Object.fromEntries(map.entries());
    window.localStorage.setItem(PREVIEW_STORAGE_KEY, JSON.stringify(obj));
  } catch {
    /* quota / private mode — degrade silently */
  }
}

function toggleSavedPlace(placeId: string): boolean {
  ensureHydrated();
  const next = new Set(cache);
  let nowSaved: boolean;
  if (next.has(placeId)) {
    next.delete(placeId);
    nowSaved = false;
  } else {
    next.add(placeId);
    nowSaved = true;
  }
  cache = next;
  writeToStorage(cache);
  emit();
  writeThrough(placeId, nowSaved);
  return nowSaved;
}

function setPlaceSaved(placeId: string, saved: boolean): void {
  if (setLocal(placeId, saved)) writeThrough(placeId, saved);
}

/** The cache alone; true when it changed. */
function setLocal(placeId: string, saved: boolean): boolean {
  ensureHydrated();
  const has = cache.has(placeId);
  if (has === saved) return false;
  const next = new Set(cache);
  if (saved) next.add(placeId);
  else next.delete(placeId);
  cache = next;
  writeToStorage(cache);
  emit();
  return true;
}

// Forget ONE place — drop it from the saved set and from the preview cache.
//
// The surgical counterpart to clearSavedPlacesLocal(): used when a specific id
// turns out to be dead server-side (consumer-web-get-place 404s on it), so the
// tile that pointed at it stops existing instead of bouncing the guest again.
// Both stores are keyed by place id — the set drives the row, the preview map
// drives its thumbnail/name — so forgetting means clearing both.
export function forgetSavedPlace(placeId: string): void {
  // Local only: the place row is gone, and its activity went with it.
  setLocal(placeId, false);
  removeSavedPlacePreview(placeId);
}

// Wipe the localStorage-backed saved set + previews and reset the in-memory
// cache, then notify subscribers. Called when the signed-in consumer changes
// (see consumer-local-reset.ts): these saves live only in the browser, so
// they outlive both a sign-out and a server-side admin database reset
// wipe. Without this, a fresh consumer signing in on the same browser — or
// the same operator re-creating an account after a DB reset — inherits the
// previous consumer's favorites (stale places from the old data). Setting
// hydrated = true keeps a later ensureHydrated() from re-reading the (now
// cleared) storage.
export function clearSavedPlacesLocal(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(PREVIEW_STORAGE_KEY);
      window.localStorage.removeItem(SYNCED_KEY);
    } catch {
      /* private mode — nothing to clear */
    }
  }
  cache = new Set();
  hydrated = true;
  emit();
}

/**
 * Adopt the server's saved set (MESITA-2442). `server` is newest first, with
 * the cards of the places still listed. The first sync in a browser also
 * pushes the saves made before the server held them, once. Google-only saves
 * (not place rows) stay. Never throws: a failed read keeps the cache.
 */
export async function syncSavedPlaces<T extends { id: string }>(
  read: () => Promise<{ ids: string[]; places: T[] }>,
  push: (placeId: string) => Promise<unknown>,
): Promise<void> {
  if (typeof window === "undefined") return;
  let server: { ids: string[]; places: T[] };
  try {
    server = await read();
  } catch {
    return;
  }
  ensureHydrated();
  let firstSync = false;
  try {
    firstSync = window.localStorage.getItem(SYNCED_KEY) == null;
  } catch {
    /* private mode — treat as synced so nothing is pushed twice */
  }
  const onServer = new Set(server.ids);
  const pushed: string[] = [];
  if (firstSync) {
    for (const id of cache) {
      if (!UUID_RE.test(id) || onServer.has(id)) continue;
      try {
        await push(id);
        pushed.push(id);
      } catch {
        /* the place may be gone; it drops out below */
      }
    }
    try {
      window.localStorage.setItem(SYNCED_KEY, "1");
    } catch {
      /* best effort */
    }
  }
  const map = readPreviewStorage<T>();
  for (const p of server.places) map.set(p.id, p);
  writePreviewStorage(map);
  // Insertion order is oldest first (savedPlaceList reverses it).
  const next = new Set<string>([...server.ids].reverse());
  for (const id of pushed) next.add(id);
  for (const id of cache) if (!UUID_RE.test(id)) next.add(id);
  cache = next;
  hydrated = true;
  writeToStorage(cache);
  emit();
}

export function upsertSavedPlacePreview<T extends { id: string }>(
  place: T,
): void {
  if (typeof window === "undefined") return;
  const map = readPreviewStorage<T>();
  map.set(place.id, place);
  writePreviewStorage(map);
}

export function removeSavedPlacePreview(placeId: string): void {
  if (typeof window === "undefined") return;
  const map = readPreviewStorage<{ id: string }>();
  if (!map.delete(placeId)) return;
  writePreviewStorage(map);
}

export function readSavedPlacePreviews<T extends { id: string }>(): Map<
  string,
  T
> {
  return readPreviewStorage<T>();
}

// React hook — returns the live set + helpers. Re-renders whenever any
// caller mutates the store via toggleSavedPlace / setPlaceSaved.
export function useSavedPlaces() {
  const savedIds = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  // `false` until the localStorage read lands. Gate empty states on this or
  // they flash to everyone who has saves — see getHydratedSnapshot above.
  const hydrated = useSyncExternalStore(
    subscribe,
    getHydratedSnapshot,
    getHydratedServerSnapshot,
  );
  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);
  const toggle = useCallback((id: string) => toggleSavedPlace(id), []);
  const setSaved = useCallback(
    (id: string, saved: boolean) => setPlaceSaved(id, saved),
    [],
  );
  return { savedIds, hydrated, isSaved, toggle, setSaved };
}
