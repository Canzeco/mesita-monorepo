"use client";

// The place the side menu names (MESITA-3136). The console layout only knows
// the places you run, so Mesita staff opening any other place saw "Place".
// The place layout, which reads the place anyway, hands its name and photo
// here; the menu reads it with useSyncExternalStore.
//
// Places can also pick it without opening the place (Pato, MESITA-3152:
// "you change what is the currently selected place"), and the pick is
// remembered on this browser, so the menu keeps it after a reload.

import { useEffect, useSyncExternalStore } from "react";

export type NamedPlace = { id: string; name: string | null; photo: string | null };

const STORE_KEY = "mesita.business.selected-place";

function readStored(): NamedPlace | null {
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const v = raw ? (JSON.parse(raw) as Partial<NamedPlace>) : null;
    return v && typeof v.id === "string" ? { id: v.id, name: v.name ?? null, photo: v.photo ?? null } : null;
  } catch {
    return null;
  }
}

let current: NamedPlace | null = typeof window === "undefined" ? null : readStored();
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function set(next: NamedPlace | null) {
  if (current?.id === next?.id && current?.name === next?.name && current?.photo === next?.photo) return;
  current = next;
  try {
    if (next) window.localStorage.setItem(STORE_KEY, JSON.stringify(next));
    else window.localStorage.removeItem(STORE_KEY);
  } catch {
    // Private windows and blocked storage: the pick lasts this visit only.
  }
  for (const fn of listeners) fn();
}

/** Makes this the place the side menu works on (MESITA-3152). */
export function selectShellPlace(place: NamedPlace) {
  set(place);
}

/** The place the open page shows, or null. */
export function useShellPlace(): NamedPlace | null {
  return useSyncExternalStore(subscribe, () => current, () => null);
}

/** Rendered by the place layout: names its place in the side menu. */
export function ShellPlaceName({ id, name, photo }: NamedPlace) {
  useEffect(() => {
    set({ id, name, photo });
  }, [id, name, photo]);
  return null;
}
