"use client";

// The open place, published UP to the rail (MESITA-1710).
//
// WHY THIS EXISTS. The rail is rendered by `(shell)/layout.tsx`, which sits
// ABOVE `places/[id]/layout.tsx` — the only thing that knows a place's name.
// A server layout cannot read the pathname, and re-fetching the place in the
// shell would be a second `business-web-get-place` on every navigation for a
// string the child already has in hand.
//
// So the child PUBLISHES and the rail SUBSCRIBES: the provider lives in the
// shell, `<PublishOpenPlace>` renders inside the place layout and writes the
// name into it on mount.
//
// This is NOT the discard guard's problem, and must never grow into it. The
// rail's place row is a plain <Link>, exactly like every other rail row, and
// carries the same (unguarded) semantics the old TopNav links had. The four
// TABS stay in PlaceBar, where they can reach PlaceProvider — see
// GuardedPlaceTabs. Publishing a name upward is safe; publishing navigation
// upward would not be.

import { createContext, useContext, useEffect, useState } from "react";

export type OpenPlace = {
  id: string;
  name: string;
  /** True when an organization holds it — decides which child row it nests
   *  under in the rail. A pool place is `false`. */
  owned: boolean;
};

type Store = {
  place: OpenPlace | null;
  setPlace: (place: OpenPlace | null) => void;
};

// Defaults rather than `undefined`: the rail renders on screens that have no
// place layout at all, so a missing provider must be a no-op, never a throw.
const OpenPlaceContext = createContext<Store>({
  place: null,
  setPlace: () => {},
});

export function OpenPlaceProvider({ children }: { children: React.ReactNode }) {
  const [place, setPlace] = useState<OpenPlace | null>(null);
  return (
    <OpenPlaceContext.Provider value={{ place, setPlace }}>
      {children}
    </OpenPlaceContext.Provider>
  );
}

export function useOpenPlace(): OpenPlace | null {
  return useContext(OpenPlaceContext).place;
}

/** Rendered by the place layout. Writes the name up, clears it on unmount so
 *  the row disappears the moment you navigate off the place. */
export function PublishOpenPlace({ id, name, owned }: OpenPlace) {
  const { setPlace } = useContext(OpenPlaceContext);
  useEffect(() => {
    setPlace({ id, name, owned });
    return () => setPlace(null);
  }, [id, name, owned, setPlace]);
  return null;
}
