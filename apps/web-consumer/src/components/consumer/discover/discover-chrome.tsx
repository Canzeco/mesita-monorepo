"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Is Discover's search bar live — i.e. is the software keyboard up?
 *
 * WHY A CONTEXT AND NOT A PROP. `DiscoverModeNav` and the active mode are
 * SIBLINGS under `discover/layout.tsx`, and that layout is a server component
 * — it cannot hold the state, and the two have no other common ancestor short
 * of the shell. This provider is the smallest client boundary containing both.
 *
 * WHY IT EXISTS. On a phone the keyboard takes a little over half the frame.
 * With the mode rail (44px) and the catalog rail (~130px) still painted, the
 * map — the thing Search IS — was down to a strip barely taller than one
 * result row, under a rail answering a question the guest had stopped asking:
 * its cards are the nearby catalog, not the results.
 *
 * FOCUS, NOT QUERY LENGTH, is the trigger. The rail already stepped aside at
 * two characters, which is the wrong moment twice over — the keyboard is
 * already up at zero characters, and it is still up while the guest deletes
 * back down to one. What the chrome is reacting to is the keyboard, so it
 * reacts to the thing that summons it.
 *
 * The flag is written ONLY from focus and blur handlers. Deriving it in an
 * effect would trip the set-state-in-effect rule and buy nothing: focus is
 * already an event.
 */
type DiscoverChrome = {
  /** The search bar holds focus, so the keyboard is covering the frame. */
  barFocused: boolean;
  setBarFocused: (value: boolean) => void;
};

const DiscoverChromeContext = createContext<DiscoverChrome | null>(null);

export function DiscoverChromeProvider({ children }: { children: ReactNode }) {
  const [barFocused, setBarFocused] = useState(false);
  const value = useMemo(() => ({ barFocused, setBarFocused }), [barFocused]);

  return (
    <DiscoverChromeContext.Provider value={value}>
      {children}
    </DiscoverChromeContext.Provider>
  );
}

const NO_PROVIDER: DiscoverChrome = {
  barFocused: false,
  setBarFocused: () => {},
};

/**
 * Never throws. The mode rail also renders on Catalog, Swipe, Chat and Favs,
 * none of which own a search bar, and `SearchBar` itself is shared with Pay's
 * wallet, which is outside this frame entirely. "No provider" means "nobody is
 * searching" — the correct answer everywhere it happens.
 */
export function useDiscoverChrome(): DiscoverChrome {
  return useContext(DiscoverChromeContext) ?? NO_PROVIDER;
}
