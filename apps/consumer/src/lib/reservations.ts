// Reservations store — mock implementation backed by localStorage.
// Mirrors the saved-venues.ts shape: module-scope cache +
// useSyncExternalStore + cross-tab sync. Public API is what the future
// `consumer-list-reservations` EF will return, so swapping the backend
// in is a one-file change.

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "mesita:reservations";

export type Reservation = {
  id: string;
  venueId: string;
  venueName: string;
  // ISO date (YYYY-MM-DD) — picked by the sheet's date pill row.
  date: string;
  // 24h time (HH:MM) — picked by the sheet's time slot grid.
  time: string;
  partySize: number;
  // Creation epoch ms — used to sort newest-first in the Saved page.
  createdAt: number;
  // Coarse lifecycle. The mock only emits "upcoming"; "past" / "cancelled"
  // round out the shape so future EF rows fit without a type change.
  status: "upcoming" | "past" | "cancelled";
};

type Listener = () => void;

let cache: ReadonlyArray<Reservation> = [];
let hydrated = false;
const listeners = new Set<Listener>();

function readFromStorage(): Reservation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((r): r is Reservation => {
      return (
        r != null &&
        typeof r === "object" &&
        typeof (r as Reservation).id === "string" &&
        typeof (r as Reservation).venueId === "string" &&
        typeof (r as Reservation).date === "string" &&
        typeof (r as Reservation).time === "string"
      );
    });
  } catch {
    return [];
  }
}

function writeToStorage(list: ReadonlyArray<Reservation>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* quota / private mode */
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

function getSnapshot(): ReadonlyArray<Reservation> {
  ensureHydrated();
  return cache;
}

const EMPTY: ReadonlyArray<Reservation> = [];
function getServerSnapshot() {
  return EMPTY;
}

export function listReservations(): ReadonlyArray<Reservation> {
  ensureHydrated();
  return cache;
}

export function addReservation(input: {
  venueId: string;
  venueName: string;
  date: string;
  time: string;
  partySize: number;
}): Reservation {
  ensureHydrated();
  const r: Reservation = {
    id: crypto.randomUUID(),
    venueId: input.venueId,
    venueName: input.venueName,
    date: input.date,
    time: input.time,
    partySize: input.partySize,
    createdAt: Date.now(),
    status: "upcoming",
  };
  cache = [r, ...cache];
  writeToStorage(cache);
  emit();
  return r;
}

export function cancelReservation(id: string): void {
  ensureHydrated();
  const next = cache.map((r) =>
    r.id === id ? { ...r, status: "cancelled" as const } : r,
  );
  cache = next;
  writeToStorage(cache);
  emit();
}

export function useReservations(): ReadonlyArray<Reservation> {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useReservationActions() {
  const add = useCallback(
    (input: Parameters<typeof addReservation>[0]) => addReservation(input),
    [],
  );
  const cancel = useCallback((id: string) => cancelReservation(id), []);
  return { add, cancel };
}
