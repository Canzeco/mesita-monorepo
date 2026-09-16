"use client";

// A PLACE VIEW PAGE READS NOTHING.
//
// The layout resolves the place ONCE and publishes it; every view below reads
// it out of this context. That is not a performance trick — it is what keeps a
// tab from re-deriving the place's identity and quietly disagreeing with the
// heading above it, which is how two screens end up describing two different
// venues under one name.
import { createContext, useContext } from "react";
import type { MockPlace } from "@/mock/types";
import type { PlaceTab } from "@/lib/place-tabs";

export type PlaceScopeValue = {
  place: MockPlace | null;
  /** A place in the POOL: real to Mesita, held by nobody. It has no manage
   *  surface at all — Profile alone, and read-only. */
  pool: { id: string; name: string; category: string; city: string } | null;
  /** The views this caller may open here. `PlaceTabGate` refuses everything
   *  outside it, because a view reachable by typing its address is a view. */
  tabs: PlaceTab[];
};

const Ctx = createContext<PlaceScopeValue | null>(null);

export function PlaceScopeProvider({
  value,
  children,
}: {
  value: PlaceScopeValue;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePlaceScope(): PlaceScopeValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePlaceScope must be used under a place layout");
  return v;
}

/** The held place, or a throw. For the views that cannot render without one —
 *  every view except Profile. The gate has already refused those addresses on
 *  a pool place, so reaching here without a place is a bug, not a state. */
export function useHeldPlace(): MockPlace {
  const { place } = usePlaceScope();
  if (!place) throw new Error("This view requires a held place");
  return place;
}
