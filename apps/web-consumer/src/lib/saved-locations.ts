// Saved locations — the guest's own pins (Home, Office…) that Places can
// search from (Pato, MESITA-2380: "no premier Mesita zones, you just save
// them").
//
// EVERY SAVED LOCATION IS A CONFIRMED PIN (Pato, 2026-10-20, MESITA-2501):
// the guest sees the point on a map and confirms it, because a typed "San
// Pedro" once resolved to Coahuila and Home, which has no map, searched
// there silently. Saved areas (a city's rectangle, MESITA-2383) are gone.
//
// An entry stores its pin and three names: `suggestedName` (the colonia
// under the pin, from Google), `customName` (what the guest typed: "Casa")
// and `formattedAddress` (the street, the row's second line). It shows
// `customName ?? suggestedName ?? "Saved location"`, kept in `name` on every
// write so a build from before this change still reads every entry. The
// fields map one-to-one onto MESITA-2400's server row (public.saved_locations).
//
// A PIN HAS NO RADIUS (MESITA-2914): the Catalog ranks every place from the
// point (MESITA-2909). The `radiusKm` an entry stored from MESITA-2703 on is
// dropped on read and never written again.
//
// THE SERVER HOLDS THEM (MESITA-2400), the same way Favorites work
// (saved-places.ts): public.saved_locations, one row per guest × pin. This
// browser's list is a CACHE that paints first: every change writes through
// the remote sink (setSavedLocationsRemote, wired by ConsumerLocalDataGuard),
// and syncSavedLocations() adopts the server's list on every shell mount. The
// first sync in a browser pushes the pins saved before the server held them,
// once. consumer-local-reset.ts wipes the cache when a different guest signs
// in.
//
// An entry from before MESITA-2501 (`{ id, name, lat, lng, kind, bounds? }`)
// reads as an UNCONFIRMED point at its own lat/lng: it cannot drive Home
// until the guest confirms it on the map, and its old name survives as
// `legacyName` for the confirm screen's "Was:" line.

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "mesita:saved-locations";
// Set once this browser's pre-server pins were pushed up (MESITA-2400).
const SYNCED_KEY = "mesita:saved-locations-synced";

/** Where a change is written through. Null until the shell wires it.
 *  `front`: the pin moves to the front of the list (a backfill does not). */
export type SavedLocationsRemote = {
  upsert: (location: SavedLocation, front: boolean) => void;
  remove: (id: string) => void;
};
let remote: SavedLocationsRemote | null = null;

export function setSavedLocationsRemote(sink: SavedLocationsRemote | null): void {
  remote = sink;
}

/** At most this many; see `evictionFor` for which one makes room. */
export const SAVED_LOCATIONS_MAX = 8;
export const SAVED_LOCATION_FALLBACK = "Saved location";
/** Google-made names are refreshed after this long (its terms allow only
 *  temporary caching); the guest's own `customName` never expires. */
export const SAVED_NAME_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type SavedLocation = {
  id: string;
  /** The display name, derived on every write. */
  name: string;
  lat: number;
  lng: number;
  suggestedName: string | null;
  customName: string | null;
  formattedAddress: string | null;
  /** The free `location_kind` hook: every saved location is a point. */
  kind: "point";
  nameEdited: boolean;
  /** When the Google-made names were fetched (ms); null = never. */
  namedAt: number | null;
  /** The names do not describe this pin yet: the backfill fetches them. */
  needsName: boolean;
  /** A pre-MESITA-2501 entry no one has confirmed on the map. */
  unconfirmed: boolean;
  /** That entry's old name, for "Was: <name>"; cleared on confirm. */
  legacyName: string | null;
};

export function displayName(l: Pick<SavedLocation, "customName" | "suggestedName">): string {
  return l.customName ?? l.suggestedName ?? SAVED_LOCATION_FALLBACK;
}

const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

const strOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.trim() ? v.trim() : null;

type Listener = () => void;

const EMPTY: readonly SavedLocation[] = [];
let cache: readonly SavedLocation[] = EMPTY;
let hydrated = false;
const listeners = new Set<Listener>();

/** A stored entry, upgraded. Anything without a pin is dropped. */
function toSavedLocation(x: unknown): SavedLocation | null {
  if (!x || typeof x !== "object") return null;
  const o = x as Record<string, unknown>;
  if (typeof o.id !== "string") return null;
  if (!finite(o.lat) || !finite(o.lng)) return null;
  if (typeof o.nameEdited === "boolean") {
    const entry = {
      id: o.id,
      lat: o.lat,
      lng: o.lng,
      suggestedName: strOrNull(o.suggestedName),
      customName: strOrNull(o.customName),
      formattedAddress: strOrNull(o.formattedAddress),
      kind: "point" as const,
      nameEdited: o.nameEdited,
      namedAt: finite(o.namedAt) ? o.namedAt : null,
      needsName: o.needsName === true,
      unconfirmed: o.unconfirmed === true,
      legacyName: strOrNull(o.legacyName),
    };
    return { ...entry, name: displayName(entry) };
  }
  // Before MESITA-2501: the old name was Google's name for the typed query,
  // so it is only a provisional suggestion; a rectangle is dropped.
  const old = strOrNull(o.name);
  const entry = {
    id: o.id,
    lat: o.lat,
    lng: o.lng,
    suggestedName: old,
    customName: null,
    formattedAddress: null,
    kind: "point" as const,
    nameEdited: false,
    namedAt: null,
    needsName: true,
    unconfirmed: true,
    legacyName: old,
  };
  return { ...entry, name: displayName(entry) };
}

function readFromStorage(): readonly SavedLocation[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return readStoredLocations(JSON.parse(raw) as unknown).slice(0, SAVED_LOCATIONS_MAX);
  } catch {
    return EMPTY;
  }
}

/** Every write re-derives `name`. False when the browser refused to keep it
 *  (private mode, quota): the list still lives for this visit. */
function write(next: readonly SavedLocation[]): boolean {
  cache = next.map((l) => ({ ...l, name: displayName(l) }));
  let kept = true;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {
      kept = false;
    }
  }
  for (const l of listeners) l();
  return kept;
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

export function getSavedLocations(): readonly SavedLocation[] {
  ensureHydrated();
  return cache;
}

function getServerSnapshot(): readonly SavedLocation[] {
  return EMPTY;
}

/** Which entry a ninth save drops: the oldest one with no `customName` that
 *  is not the active location. Null when the list has room. `undefined` when
 *  it is full of named pins: the save waits for the guest to remove one. */
export function evictionFor(
  list: readonly SavedLocation[],
  activeId: string | null,
): SavedLocation | null | undefined {
  if (list.length < SAVED_LOCATIONS_MAX) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    const l = list[i];
    if (!l.customName && l.id !== activeId) return l;
  }
  return undefined;
}

export type SavedLocationInput = {
  lat: number;
  lng: number;
  suggestedName: string | null;
  customName: string | null;
  formattedAddress: string | null;
  nameEdited: boolean;
  needsName: boolean;
};

export type SaveResult = { location: SavedLocation; kept: boolean };

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** A new pin, newest first. Null when eight named pins leave no room. */
export function addSavedLocation(
  input: SavedLocationInput,
  activeId: string | null = null,
  now = Date.now(),
): SaveResult | null {
  ensureHydrated();
  const evict = evictionFor(cache, activeId);
  if (evict === undefined) return null;
  const base = {
    id: newId(),
    lat: input.lat,
    lng: input.lng,
    suggestedName: strOrNull(input.suggestedName),
    customName: strOrNull(input.customName),
    formattedAddress: strOrNull(input.formattedAddress),
    kind: "point" as const,
    nameEdited: input.nameEdited,
    namedAt: input.needsName ? null : now,
    needsName: input.needsName,
    unconfirmed: false,
    legacyName: null,
  };
  const location: SavedLocation = { ...base, name: displayName(base) };
  const rest = evict ? cache.filter((l) => l.id !== evict.id) : cache;
  const kept = write([location, ...rest]);
  // The eviction first: the server refuses a ninth pin.
  if (evict) remote?.remove(evict.id);
  remote?.upsert(getSavedLocations()[0], true);
  return { location: getSavedLocations()[0], kept };
}

export type SavedLocationPatch = Partial<Omit<SavedLocation, "id" | "name" | "kind">>;

/** Change one entry in place of its id, moved to the front. */
export function updateSavedLocation(id: string, patch: SavedLocationPatch): SaveResult | null {
  ensureHydrated();
  const current = cache.find((l) => l.id === id);
  if (!current) return null;
  const next = { ...current, ...patch, id, kind: "point" as const };
  const kept = write([next, ...cache.filter((l) => l.id !== id)]);
  remote?.upsert(getSavedLocations()[0], true);
  return { location: getSavedLocations()[0], kept };
}

/** Change one entry where it stands (a backfill must not reorder the list). */
export function patchSavedLocationInPlace(id: string, patch: SavedLocationPatch): boolean {
  ensureHydrated();
  if (!cache.some((l) => l.id === id)) return false;
  const kept = write(
    cache.map((l) => (l.id === id ? { ...l, ...patch, id, kind: "point" as const } : l)),
  );
  const written = cache.find((l) => l.id === id);
  if (written) remote?.upsert(written, false);
  return kept;
}

/** A pin ready to save from the picker: the confirm screen clears the
 *  legacy flags, any save stamps when Google named it. */
export function confirmedPatch(input: SavedLocationInput, now = Date.now()): SavedLocationPatch {
  return {
    lat: input.lat,
    lng: input.lng,
    suggestedName: strOrNull(input.suggestedName),
    customName: strOrNull(input.customName),
    formattedAddress: strOrNull(input.formattedAddress),
    nameEdited: input.nameEdited,
    needsName: input.needsName,
    namedAt: input.needsName ? null : now,
    unconfirmed: false,
    legacyName: null,
  };
}

export function removeSavedLocation(id: string): void {
  ensureHydrated();
  if (!cache.some((l) => l.id === id)) return;
  write(cache.filter((l) => l.id !== id));
  remote?.remove(id);
}

/** Called by consumer-local-reset.ts when the signed-in guest changes. */
export function clearSavedLocationsLocal(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(SYNCED_KEY);
    } catch {
      /* private mode — nothing to clear */
    }
  }
  cache = EMPTY;
  hydrated = true;
  for (const l of listeners) l();
}

/**
 * Adopt the server's list (MESITA-2400), newest first. The first sync in a
 * browser also pushes the pins saved before the server held them, once,
 * oldest first so the newest ends up in front, while the server has room.
 * Never throws: a failed read keeps the cache.
 */
export async function syncSavedLocations(
  read: () => Promise<unknown[]>,
  push: (location: SavedLocation) => Promise<unknown>,
): Promise<void> {
  if (typeof window === "undefined") return;
  let server: SavedLocation[];
  try {
    server = readStoredLocations(await read());
  } catch {
    return;
  }
  ensureHydrated();
  let firstSync = false;
  try {
    firstSync = window.localStorage.getItem(SYNCED_KEY) == null;
  } catch {
    /* private mode: treat as synced so nothing is pushed twice */
  }
  if (firstSync) {
    const onServer = new Set(server.map((l) => l.id));
    const pending = cache.filter((l) => !onServer.has(l.id)).reverse();
    let room = SAVED_LOCATIONS_MAX - server.length;
    let pushed = false;
    for (const l of pending) {
      if (room <= 0) break;
      try {
        await push(l);
        room -= 1;
        pushed = true;
      } catch (err) {
        // A pin the server refuses for good (400 bad entry, 409 full) is left
        // out. Anything else (offline, a 5xx) keeps the cache untouched and
        // unsynced, so the next shell mount tries again: a pin saved only in
        // this browser is never dropped by a failed push.
        const status = (err as { status?: unknown } | null)?.status;
        if (status !== 400 && status !== 409) return;
      }
    }
    if (pushed) {
      try {
        server = readStoredLocations(await read());
      } catch {
        return;
      }
    }
    try {
      window.localStorage.setItem(SYNCED_KEY, "1");
    } catch {
      /* best effort */
    }
  }
  write(server.slice(0, SAVED_LOCATIONS_MAX));
  hydrated = true;
}

/** What a stored array reads as: every entry upgraded, broken ones dropped. */
export function readStoredLocations(raw: unknown): SavedLocation[] {
  return Array.isArray(raw)
    ? raw.map(toSavedLocation).filter((l): l is SavedLocation => l !== null)
    : [];
}

export function useSavedLocations(): readonly SavedLocation[] {
  return useSyncExternalStore(subscribe, getSavedLocations, getServerSnapshot);
}
