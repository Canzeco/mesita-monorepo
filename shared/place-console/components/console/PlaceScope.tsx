"use client";

// WHAT THE LAYOUT ALREADY KNOWS, published so the pages stop re-asking
// (MESITA-1875).
//
// Pato, on the Place screen: *"make this functional. its toooo fucking slow.
// like the place items are toooo fucking slow."*
//
// ── WHY THIS FILE EXISTS ──────────────────────────────────────────────────
//
// Every view page used to open with a read of its own — `getManagePlace`,
// and three of them `getPlaceView` beside it — and then throw the payload
// away: the tab that follows takes no props and reads `PlaceContext`, which
// the layout already provided. The reads were a GATE, nothing more.
//
// Each page carried a comment saying the reads were free because "the layout
// above already paid for them". That is true of `cache()` and false of the
// navigation that matters. `cache()` dedupes within ONE request. A hard load
// runs the layout and the page in one request, so the dedupe holds — and that
// load was never the slow one. A client navigation between siblings (Profile
// → Menus, the thing being complained about) re-runs the PAGE SEGMENT ALONE,
// in a new request: the layout does not re-run, the cache is empty, and the
// page pays `business-web-get-overview` in full. Measured in production over
// 24h: p50 472ms, p95 913ms, on a call whose entire result was a boolean.
//
// So the facts travel DOWN instead of being fetched again. The layout resolves
// the matrix once — it already did, for the rail — and publishes it here.
//
// ── WHAT IS IN IT, AND WHAT IS NOT ────────────────────────────────────────
//
// `tabs` is `tabsForAccess`'s answer, the ONE matrix (lib/place-tabs), and
// `PlaceTabGate` is its only consumer. `held` is `manage !== null` — whether
// this place has a manage surface at all. `view` is the identity payload, and
// it rides ONLY for a pool place, because that is the one branch that renders
// it; a held place gets null and reads everything through `PlaceContext`.
//
// The AdminPlace does NOT ride here. `PlaceManageShell` owns it, it is
// mutable (the save bar writes it), and two providers holding one record is
// how a screen starts disagreeing with itself.

import { createContext, useContext } from "react";
import type { ConsolePlaceView } from "@/lib/api/console";
import type { PlaceTab } from "@/lib/place-tabs";

export type PlaceScopeValue = {
  placeId: string;
  /** The matrix's answer for this caller on this place. */
  tabs: readonly PlaceTab[];
  /** The caller holds this place and can manage it. */
  held: boolean;
  /** Identity + holder + claimable. Null for a held place — nothing renders
   *  it there, and shipping a second copy of a record `PlaceContext` already
   *  owns is how two readers start disagreeing. */
  view: ConsolePlaceView | null;
};

const PlaceScopeContext = createContext<PlaceScopeValue | null>(null);

export function PlaceScopeProvider({
  value,
  children,
}: {
  value: PlaceScopeValue;
  children: React.ReactNode;
}) {
  return (
    <PlaceScopeContext.Provider value={value}>
      {children}
    </PlaceScopeContext.Provider>
  );
}

/** THROWS outside the place layout, deliberately. Every reader is a page or a
 *  tab under `places/[id]`, so an absent provider is a structural mistake, not
 *  a state to render around — the same posture `usePlaceContext` takes. */
export function usePlaceScope(): PlaceScopeValue {
  const value = useContext(PlaceScopeContext);
  if (!value) {
    throw new Error("usePlaceScope must be used inside the place layout");
  }
  return value;
}
