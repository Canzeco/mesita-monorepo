"use client";

// Where the guest stands (MESITA-2466, MESITA-2471), for Home's location
// sheet: the neighbourhood's name ("Current location · Distrito Tec") and
// the areas around it, the sheet's "Around you" rows (Instagram's Add
// location). Asked only while the sheet is open and a fix is held; one
// answer per ~110 m point is kept for the visit (sessionStorage), so
// reopening the sheet spends nothing. No answer — still loading, Google had
// none, or the call failed — leaves the sheet as it was.

import { useEffect, useState } from "react";
import { apiReverseGeocode, type HereAnswer } from "@/lib/api/place-search";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// v2: an answer now carries `areas` beside the name (MESITA-2471).
const STORAGE_KEY = "mesita:here-v2";

const NONE: HereAnswer = { name: null, areas: [] };

/** The ~110 m cell an answer is kept for (the server snaps the same way). */
export function hereKey(p: { lat: number; lng: number }): string {
  return `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
}

function readAll(): Record<string, HereAnswer> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, HereAnswer>) : {};
  } catch {
    return {};
  }
}

function readAnswer(key: string): HereAnswer | null {
  const a = readAll()[key];
  return a && typeof a === "object" && Array.isArray(a.areas) ? a : null;
}

function writeAnswer(key: string, answer: HereAnswer): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [key]: answer }));
  } catch {
    /* the answer still shows for this render */
  }
}

/** The answer for `coords`; asks only when `enabled` and a fix exists. */
export function useHere(
  coords: { lat: number; lng: number } | null,
  enabled: boolean,
): HereAnswer {
  const supabase = useBrowserSupabase();
  const key = coords ? hereKey(coords) : null;
  const [fetched, setFetched] = useState<{ key: string; answer: HereAnswer } | null>(null);

  useEffect(() => {
    if (!enabled || !coords || !key || readAnswer(key)) return;
    let cancelled = false;
    void apiReverseGeocode(supabase, coords).then((answer) => {
      if (!answer) return;
      writeAnswer(key, answer);
      if (!cancelled) setFetched({ key, answer });
    });
    return () => {
      cancelled = true;
    };
    // `key` stands for `coords`: a fix inside the same cell asks nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, enabled, key]);

  if (!key) return NONE;
  return readAnswer(key) ?? (fetched?.key === key ? fetched.answer : NONE);
}
