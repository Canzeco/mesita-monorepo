"use client";

// The neighbourhood the guest stands in (MESITA-2466), for Home's location
// sheet: "Current location · Distrito Tec". Asked only while the sheet is
// open and a fix is held; one answer per ~110 m point is kept for the visit
// (sessionStorage), so reopening the sheet spends nothing. No name — still
// loading, Google had none, or the call failed — leaves the row as it was.

import { useEffect, useState } from "react";
import { apiReverseGeocode } from "@/lib/api/place-search";
import { useBrowserSupabase } from "@/lib/supabase/browser";

const STORAGE_KEY = "mesita:here-names";

/** The ~110 m cell a name is kept for (the server snaps the same way). */
export function hereKey(p: { lat: number; lng: number }): string {
  return `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
}

function readAll(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function readName(key: string): string | null {
  const name = readAll()[key];
  return typeof name === "string" && name ? name : null;
}

function writeName(key: string, name: string): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [key]: name }));
  } catch {
    /* the name still shows for this render */
  }
}

/** The name for `coords`, or null; asks only when `enabled` and a fix exists. */
export function useHereName(
  coords: { lat: number; lng: number } | null,
  enabled: boolean,
): string | null {
  const supabase = useBrowserSupabase();
  const key = coords ? hereKey(coords) : null;
  const [fetched, setFetched] = useState<{ key: string; name: string } | null>(null);

  useEffect(() => {
    if (!enabled || !coords || !key || readName(key)) return;
    let cancelled = false;
    void apiReverseGeocode(supabase, coords).then((name) => {
      if (!name) return;
      writeName(key, name);
      if (!cancelled) setFetched({ key, name });
    });
    return () => {
      cancelled = true;
    };
    // `key` stands for `coords`: a fix inside the same cell asks nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, enabled, key]);

  if (!key) return null;
  return readName(key) ?? (fetched?.key === key ? fetched.name : null);
}
