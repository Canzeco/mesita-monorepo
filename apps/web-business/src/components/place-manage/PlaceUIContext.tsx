"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Per-place UI state that must outlive a TAB, and nothing else.
 *
 * Why this is not on `PlaceContext`: that context is the ONE all-or-nothing
 * `saveAll` for every tab, and its docblock is a 25-line essay about being
 * exactly that. Putting an expand flag in its `useMemo` re-creates the context
 * value on every toggle, so one click on Team re-renders PlaceSection,
 * MenusSection, both channel rows, PlaceEditChrome and ProfileCompleteness —
 * none of which asked. There is no correctness risk (`saveAll` is a separate
 * `useCallback`), but a context that means one thing is worth keeping.
 *
 * Why a CONTEXT at all, rather than `useState` inside TeamSection: the Controls
 * page unmounts when the operator switches to Profile, which is the exact
 * moment the state has to survive. This provider is mounted by
 * `PlaceEditShell`, above the tab routes, so App Router keeps it across
 * Profile → Controls → Profile and drops it when the PLACE changes — which is
 * the correct scope. `sessionStorage` was rejected: it needs an effect to read,
 * so the panel would flash collapsed on every mount.
 *
 * Decision 4 of MESITA-1399.
 */
type PlaceUIValue = {
  /** Controls › Settings: is the Team panel open? */
  teamExpanded: boolean;
  setTeamExpanded: (next: boolean) => void;
};

const PlaceUIContext = createContext<PlaceUIValue | null>(null);

export function PlaceUIProvider({ children }: { children: ReactNode }) {
  // Collapsed by default: production has 23 places and `project_members = 0`
  // on all of them, so the common case is an empty panel nobody needs open.
  const [teamExpanded, setTeamExpanded] = useState(false);
  const value = useMemo(
    () => ({ teamExpanded, setTeamExpanded }),
    [teamExpanded],
  );
  return (
    <PlaceUIContext.Provider value={value}>{children}</PlaceUIContext.Provider>
  );
}

/**
 * Falls back to local-only state when no provider is mounted, so a component
 * under test (or rendered outside the place shell) still works instead of
 * throwing. `usePlaceContext` throws because a missing save context is a bug;
 * a missing expand flag is not.
 */
export function usePlaceUI(): PlaceUIValue {
  const ctx = useContext(PlaceUIContext);
  const [fallback, setFallback] = useState(false);
  const local = useMemo(
    () => ({ teamExpanded: fallback, setTeamExpanded: setFallback }),
    [fallback],
  );
  return ctx ?? local;
}
