"use client";

// The newest notification this guest has seen, on this device (MESITA-3717,
// Pato: "if there is an event not viewed yet, put red bubble"). Activity ›
// Notifications marks it when its rows are on screen; the bar's Me tab, Me's
// Notifications tile and the chip wear a red dot while a newer one exists.
// One ISO time in localStorage, read through useSyncExternalStore like
// lib/social-seen.ts (the server snapshot is null: no hydration mismatch).
// `consumer_notifications` has no read column, so "seen" is per device.

import { useSyncExternalStore } from "react";
import { hasUnseen } from "./social-seen";

const KEY = "mesita:notifications-seen-at";
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

/** The guest has seen notifications up to `at`. Never moves backwards. */
export function markNotificationsSeen(at: string | null | undefined): void {
  if (!at || !hasUnseen(at, read())) return;
  try {
    window.localStorage.setItem(KEY, at);
  } catch {
    // best-effort: the dot may show once more
  }
  for (const l of listeners) l();
}

/** Another account owns this browser now (lib/consumer-local-reset.ts). */
export function clearNotificationsSeenLocal(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // best-effort
  }
  for (const l of listeners) l();
}

export function useNotificationsSeenAt(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}
