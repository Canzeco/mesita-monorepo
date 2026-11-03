"use client";

// The place the side menu names (MESITA-3136). The console layout only knows
// the places you run, so Mesita staff opening any other place saw "Place".
// The place layout, which reads the place anyway, hands its name and photo
// here; the menu reads it with useSyncExternalStore.

import { useEffect, useSyncExternalStore } from "react";

export type NamedPlace = { id: string; name: string | null; photo: string | null };

let current: NamedPlace | null = null;
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
  for (const fn of listeners) fn();
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
