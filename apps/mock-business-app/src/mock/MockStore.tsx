"use client";

// The hooks every screen reads. There is no provider: the state lives in
// `store.ts` as an external store, and `useSyncExternalStore` is how React
// subscribes to one. A context around a module singleton would be a second
// mechanism holding the same value.
import { useMemo, useSyncExternalStore } from "react";
import {
  getHydrated,
  getLastPlaceId,
  getScenario,
  getServerHydrated,
  getServerLastPlaceId,
  getServerScenario,
  rememberPlace,
  resetScenario,
  setScenario,
  subscribe,
} from "@/mock/store";
import { resolveWorld, type Scenario, type World } from "@/mock/scenario";
import { MOCK_NOW, VIEWER } from "@/mock/fixtures";

export function useMock(): {
  scenario: Scenario;
  setScenario: (patch: Partial<Scenario>) => void;
  resetScenario: () => void;
  world: World;
  /** The last place opened. It is what a flat address resolves against. */
  lastPlaceId: string | null;
  rememberPlace: (id: string | null) => void;
  /** The fixture's FIXED now. Never `Date.now()` — see mock/fixtures.ts. */
  now: Date;
  viewer: typeof VIEWER;
  /** False on the server and on the first client render, true after. Screens
   *  that would 404 on a place the stored scenario DOES hold must wait for it. */
  hydrated: boolean;
} {
  const scenario = useSyncExternalStore(subscribe, getScenario, getServerScenario);
  const lastPlaceId = useSyncExternalStore(subscribe, getLastPlaceId, getServerLastPlaceId);
  const hydrated = useSyncExternalStore(subscribe, getHydrated, getServerHydrated);
  const world = useMemo(() => resolveWorld(scenario), [scenario]);

  return {
    scenario,
    setScenario,
    resetScenario,
    world,
    lastPlaceId,
    rememberPlace,
    now: MOCK_NOW,
    viewer: VIEWER,
    hydrated,
  };
}
