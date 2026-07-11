"use client";

import { useCallback, useSyncExternalStore } from "react";

// Tiny localStorage-backed store used by the device-level preferences on the
// Me page (notification / permission toggles, language + default-location
// prefs, joined communities). These are client-only settings with no EF
// behind them yet — same pattern the Settings notification toggles have used
// since the five-tab rebuild. useSyncExternalStore keeps the hydration render
// on the SSR snapshot (server default) so markup matches, then folds in the
// stored value — no setState-in-effect cascade, no hydration mismatch.
//
// A same-tab listener set fires on every local write so every subscriber in
// the tab updates live; the `storage` event keeps other tabs in sync.

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function notify(): void {
  listeners.forEach((l) => l());
}

// ─── Raw string cell ───────────────────────────────────────────────────────

function readString(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeString(key: string, value: string | null): void {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // best-effort persistence
  }
  notify();
}

// ─── Boolean flag ────────────────────────────────────────────────────────

export function useStoredFlag(
  key: string,
  defaultOn: boolean,
): [boolean, (next?: boolean) => void] {
  const on = useSyncExternalStore(
    subscribe,
    () => {
      const stored = readString(key);
      return stored == null ? defaultOn : stored === "1";
    },
    () => defaultOn,
  );
  const set = useCallback(
    (next?: boolean) => {
      const stored = readString(key);
      const current = stored == null ? defaultOn : stored === "1";
      const value = next ?? !current;
      writeString(key, value ? "1" : "0");
    },
    [key, defaultOn],
  );
  return [on, set];
}

// ─── String preference (single value) ────────────────────────────────────

export function useStoredString(
  key: string,
  defaultValue: string,
): [string, (next: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readString(key) ?? defaultValue,
    () => defaultValue,
  );
  const set = useCallback((next: string) => writeString(key, next), [key]);
  return [value, set];
}

// ─── String set (joined communities, multi-select) ───────────────────────

function parseSet(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((v): v is string => typeof v === "string")
      : [];
  } catch {
    return [];
  }
}

const EMPTY: string[] = [];

export function useStoredSet(
  key: string,
): [string[], (id: string) => void] {
  const raw = useSyncExternalStore(
    subscribe,
    () => readString(key),
    () => null,
  );
  const ids = raw == null ? EMPTY : parseSet(raw);
  const toggle = useCallback(
    (id: string) => {
      const current = parseSet(readString(key));
      const next = current.includes(id)
        ? current.filter((v) => v !== id)
        : [...current, id];
      writeString(key, JSON.stringify(next));
    },
    [key],
  );
  return [ids, toggle];
}
