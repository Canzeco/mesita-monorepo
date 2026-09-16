"use client";

// A PLACE VIEW PAGE READS NOTHING.
//
// The layout resolves the place ONCE and publishes it; every view below reads
// it out of this context. That is not a performance trick — it is what keeps a
// tab from re-deriving the place's identity and quietly disagreeing with the
// heading above it, which is how two screens end up describing two different
// venues under one name.
import { createContext, useContext } from "react";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
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
  /** The places read FAILED. Not the same fact as "this place is not yours",
   *  and this is the flag that keeps the two apart below. */
  readFailed: boolean;
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

/** The held place, or a throw. ONLY for the VIEWS under `[view]`, where
 *  `PlaceTabGate` has already refused every address a pool place or a failed
 *  read could reach — `tabsForAccess({held: false})` is `["profile"]`, so
 *  nothing else gets here without a place. Reaching it without one is a bug,
 *  not a state, and the throw says so.
 *
 *  THE PAGES MAY NOT USE THIS. `/places/<id>/{settings,activity,products,
 *  customers,products/pay}` are static segments beside `[view]` and pass
 *  through NO tab gate at all, so for them a missing place is an ordinary
 *  state — a pool id typed into the bar, or the panel flipped to "Read
 *  failed" while one of them was open. They take `useHeldPlaceOrNull` and
 *  render `<NotHeld />`, which is the gate they were missing. */
export function useHeldPlace(): MockPlace {
  const { place } = usePlaceScope();
  if (!place) throw new Error("This view requires a held place");
  return place;
}

/** The held place, or null — for the five PAGES, which have no tab gate. */
export function useHeldPlaceOrNull(): MockPlace | null {
  return usePlaceScope().place;
}

/** What a held-only surface renders when there is no held place.
 *
 *  TWO OUTCOMES, because they are two facts. A POOL place genuinely has no
 *  manage surface — nothing has been claimed, so there is no Settings to show
 *  and no Activity to list — and the honest answer is the same 404 the tab
 *  gate gives. A FAILED READ has established nothing at all: 404 there would
 *  say "this place does not exist" on the strength of a request that never
 *  completed. */
export function NotHeld() {
  const { readFailed } = usePlaceScope();
  if (!readFailed) notFound();
  return (
    <EmptyState
      kind="failed"
      title="Could not read this place"
      hint="Nothing has been established about it — only that we could not ask. Nothing here has been created or removed."
    />
  );
}
