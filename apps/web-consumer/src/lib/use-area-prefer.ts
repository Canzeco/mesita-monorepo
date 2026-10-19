"use client";

// Search's Near/Popular pick (MESITA-2425; two chips since MESITA-2426,
// which replaced All), sent as the server-side `prefer`. Home's Near and
// Popular rows are its own column state. Near (the
// default) ranks on the operator's Proximity/Popularity balance; Popular
// ranks on Popularity alone inside the same radius. A device preference,
// like the toggles consumer-local-reset leaves alone, so localStorage.

import { useSyncExternalStore } from "react";

export type AreaPrefer = "near" | "popular";

const STORAGE_KEY = "mesita_area_prefer_v1";

function readPersisted(): AreaPrefer {
  if (typeof window === "undefined") return "near";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "popular"
      ? "popular"
      : "near";
  } catch {
    return "near";
  }
}

let state: AreaPrefer | null = null;
const listeners = new Set<() => void>();

function current(): AreaPrefer {
  if (state === null) state = readPersisted();
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setAreaPrefer(next: AreaPrefer) {
  state = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore storage failures
  }
  for (const listener of listeners) listener();
}

export function useAreaPrefer(): AreaPrefer {
  return useSyncExternalStore(subscribe, current, () => "near");
}
