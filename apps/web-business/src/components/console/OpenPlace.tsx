"use client";

// The open place, published UP to the rail (MESITA-1710, extended MESITA-1714).
//
// WHY THIS EXISTS. The rail is rendered by `(shell)/layout.tsx`, which sits
// ABOVE `places/[id]/layout.tsx` — the only thing that knows a place's name,
// which views this viewer may open, and whether its form is dirty. A server
// layout cannot read the pathname, and re-fetching the place in the shell
// would be a second `business-web-get-place` on every navigation for facts
// the child already has in hand.
//
// So the child PUBLISHES and the rail SUBSCRIBES.
//
// TWO PUBLISHERS, DELIBERATELY SEPARATE:
//
//   <PublishOpenPlace>  id, name, owned, tabs — rendered by the place LAYOUT,
//                       which resolves all four server-side.
//   <PublishPlaceNav>   guardNav — rendered INSIDE PlaceProvider, because that
//                       is the only place `usePlaceContext()` does not throw.
//
// THE GUARD TRAVELS UP; THE COMPONENT DOES NOT COME DOWN. MESITA-1710 D4 said
// the four views could not live in the rail at all, because GuardedPlaceTabs
// calls `usePlaceContext()` and the provider mounts below the shell. True
// premise, wrong conclusion: the provider's position blocks RENDERING a
// context consumer up here, not REACHING the value. `guardNav` is a
// `useCallback` with deps `[isDirty, router]`, so it is render-stable and can
// simply be handed upward — the same trick the name already uses.
//
// When no guard is published (a pool place has no provider at all, and every
// non-place screen has neither), the rail's rows are plain links. That is the
// correct fallback: a place with no editable state has nothing to discard.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { PlaceTab } from "@/lib/place-tabs";

export type OpenPlace = {
  id: string;
  name: string;
  /** True when an organization holds it. A pool place is `false`. */
  owned: boolean;
  /** Exactly the views this viewer may open — `visibleTabs()`, so 1 to 4.
   *  A viewer gets Profile + Activity; `admin` only for super-admins; a pool
   *  place gets Profile alone. The rail renders this and nothing else: a
   *  greyed-out row for a view you cannot open is a worse answer than no row. */
  tabs: PlaceTab[];
};

/** Returns true when it swallowed the navigation to ask about unsaved edits. */
export type GuardNav = (
  href: string,
  e?: { preventDefault: () => void },
) => boolean;

type Store = {
  place: OpenPlace | null;
  setPlace: (place: OpenPlace | null) => void;
  guardNav: GuardNav | null;
  setGuardNav: (guard: GuardNav | null) => void;
};

// Defaults rather than `undefined`: the rail renders on screens that have no
// place layout at all, so a missing provider must be a no-op, never a throw.
const OpenPlaceContext = createContext<Store>({
  place: null,
  setPlace: () => {},
  guardNav: null,
  setGuardNav: () => {},
});

export function OpenPlaceProvider({ children }: { children: React.ReactNode }) {
  const [place, setPlace] = useState<OpenPlace | null>(null);
  // Stored wrapped, because a bare function passed to a setState updater would
  // be CALLED as an updater instead of stored.
  const [guard, setGuard] = useState<{ fn: GuardNav } | null>(null);
  const value = useMemo(
    () => ({
      place,
      setPlace,
      guardNav: guard?.fn ?? null,
      setGuardNav: (fn: GuardNav | null) => setGuard(fn ? { fn } : null),
    }),
    [place, guard],
  );
  return (
    <OpenPlaceContext.Provider value={value}>
      {children}
    </OpenPlaceContext.Provider>
  );
}

export function useOpenPlace(): OpenPlace | null {
  return useContext(OpenPlaceContext).place;
}

/** The rail's escape hatch for unsaved edits. Null when nothing is guarded. */
export function useOpenPlaceGuard(): GuardNav | null {
  return useContext(OpenPlaceContext).guardNav;
}

/** Rendered by the place layout. Clears on unmount so the rail's place section
 *  disappears the moment you navigate off the place. */
export function PublishOpenPlace({ id, name, owned, tabs }: OpenPlace) {
  const { setPlace } = useContext(OpenPlaceContext);
  // `tabs` is a fresh array each render, so join it into a primitive for the
  // dependency list — otherwise this effect re-runs on every render forever.
  const tabKey = tabs.join(",");
  useEffect(() => {
    setPlace({ id, name, owned, tabs: tabKey.split(",") as PlaceTab[] });
    return () => setPlace(null);
  }, [id, name, owned, tabKey, setPlace]);
  return null;
}

/** Rendered INSIDE PlaceProvider — the only scope where `guardNav` exists. */
export function PublishPlaceNav({ guardNav }: { guardNav: GuardNav }) {
  const { setGuardNav } = useContext(OpenPlaceContext);
  useEffect(() => {
    setGuardNav(guardNav);
    return () => setGuardNav(null);
  }, [guardNav, setGuardNav]);
  return null;
}
