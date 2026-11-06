"use client";

import { useEffect, useSyncExternalStore } from "react";
import { isMesitaPlaceId } from "@/lib/api/activity";
import { apiListRewardPercents } from "@/lib/api/rewards";
import { createBrowserSupabase } from "@/lib/supabase/browser";

// THE COUPON IS THE SERVER'S NUMBER (MESITA-3288): what this guest would really get
// at this place, or nothing. Cards ask one at a time as they mount, so the asks wait
// a tick and go as one call. A failed read leaves the coupon off: never a guess.

/** The most one call may ask about (consumer-web-list-reward-percents). */
const MAX_PLACES = 100;

/** A place's percent once asked; null means none, or the read failed. */
const known = new Map<string, number | null>();
const waiting = new Set<string>();
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const ids = [...waiting].slice(0, MAX_PLACES);
  for (const id of ids) waiting.delete(id);
  if (waiting.size > 0) timer = setTimeout(flush, 0);
  const settle = (percents: Record<string, number>) => {
    for (const id of ids) known.set(id, percents[id] ?? null);
    for (const listener of listeners) listener();
  };
  apiListRewardPercents(createBrowserSupabase(), ids).then(settle, () => settle({}));
}

function ask(placeId: string) {
  if (known.has(placeId) || waiting.has(placeId) || !isMesitaPlaceId(placeId)) return;
  waiting.add(placeId);
  timer ??= setTimeout(flush, 0);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The coupon's words. "Up to": Story counts, and staff check it at the till. */
export function rewardLabel(percent: number): string {
  return `Up to ${percent}% OFF for you`;
}

/** This guest's coupon at this place, or null when the place takes nothing off. */
export function useRewardLabel(placeId: string): string | null {
  useEffect(() => ask(placeId), [placeId]);
  const percent = useSyncExternalStore(
    subscribe,
    () => known.get(placeId) ?? null,
    () => null,
  );
  return percent ? rewardLabel(percent) : null;
}
