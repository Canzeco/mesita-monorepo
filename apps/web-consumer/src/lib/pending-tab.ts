"use client";

// THE TAB A TAP IS ON ITS WAY TO (MESITA-2846). The bar sets it on
// finger-down; PendingScreen draws that tab's placeholder over the old screen
// at once, and the bar lights it, both before the server has answered. It
// holds only while the screen it was tapped on is still the screen: once the
// pathname moves, the page itself is the truth and the mark is cleared.
// A module store read through useSyncExternalStore, so the bar and the
// screen share it without a provider and without setState in an effect.

import { useSyncExternalStore } from "react";

type Pending = { href: string; on: string };

let current: Pending | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** A tap on the tab at `href` from the screen at bare path `on`. */
export function setPendingTab(href: string, on: string): void {
  current = { href, on };
  emit();
}

/** Forget the mark once the screen it was tapped on is gone. */
export function clearPendingTabOff(pathname: string): void {
  if (!current || current.on === pathname) return;
  current = null;
  emit();
}

/** The tab being opened from the screen at bare path `pathname`, if any. */
export function usePendingTab(pathname: string): string | null {
  const pending = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
  return pending && pending.on === pathname ? pending.href : null;
}
