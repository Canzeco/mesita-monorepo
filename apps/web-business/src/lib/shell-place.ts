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

/** MESITA-3384: the open place's Stripe account cannot charge yet, so the menu
 *  draws one quiet dot on Payments. Set only by the place layout, which read
 *  it from the server; never remembered across reloads. */
let connectStripeFor: string | null = null;

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

function set(next: NamedPlace | null, connectStripe = false) {
  const nudge = connectStripe && next ? next.id : null;
  if (current?.id === next?.id && current?.name === next?.name && current?.photo === next?.photo && nudge === connectStripeFor) return;
  // A fresh object, so the snapshot changes when only the nudge does.
  current = next ? { id: next.id, name: next.name, photo: next.photo } : null;
  connectStripeFor = nudge;
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

/** Whether the menu shows the Connect Stripe dot on this place's Payments. */
export function needsStripeConnect(placeId: string | null): boolean {
  return !!placeId && connectStripeFor === placeId;
}

/** Rendered by the place layout: names its place in the side menu. */
export function ShellPlaceName({ id, name, photo, connectStripe = false }: NamedPlace & { connectStripe?: boolean }) {
  useEffect(() => {
    set({ id, name, photo }, connectStripe);
  }, [id, name, photo, connectStripe]);
  return null;
}
