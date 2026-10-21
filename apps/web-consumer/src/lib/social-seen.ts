"use client";

// The newest Social event this guest has seen, on this device (MESITA-2536).
// SocialFeed marks it whenever real events are on screen; Home's Social tab
// wears a dot while a newer one has arrived. One ISO time in localStorage,
// read through useSyncExternalStore (a same-tab listener set, plus the
// `storage` event for other tabs), so no setState-in-effect and no hydration
// mismatch: the server snapshot is null.

import { useSyncExternalStore } from "react";

const KEY = "mesita:social-seen-at";
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

/** Is `newestAt` later than what the guest has seen? Nothing seen yet and an
 *  event exists: yes. No event: no. */
export function hasUnseen(
  newestAt: string | null,
  seenAt: string | null,
): boolean {
  if (!newestAt) return false;
  const n = Date.parse(newestAt);
  if (!Number.isFinite(n)) return false;
  const s = seenAt ? Date.parse(seenAt) : Number.NaN;
  return !Number.isFinite(s) || n > s;
}

/** The guest has seen events up to `at`. Never moves backwards. */
export function markSocialSeen(at: string | null | undefined): void {
  if (!at || !hasUnseen(at, read())) return;
  try {
    window.localStorage.setItem(KEY, at);
  } catch {
    // best-effort: the dot may show once more
  }
  for (const l of listeners) l();
}

export function useSocialSeenAt(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
