"use client";

import { createContext, useContext } from "react";
import type { MyPlace } from "@/lib/api/places";

// Carries the per-request unit data (fetched once in the unit layout) down
// to the app bar so it can render the place switcher without every page
// having to re-plumb props. Consumed by PlaceDock.
type PlaceChrome = {
  activePlaceId: string | null;
  places: MyPlace[];
};

const PlaceChromeContext = createContext<PlaceChrome | null>(null);

export function PlaceChromeProvider({
  value,
  children,
}: {
  value: PlaceChrome;
  children: React.ReactNode;
}) {
  return (
    <PlaceChromeContext.Provider value={value}>
      {children}
    </PlaceChromeContext.Provider>
  );
}

export function usePlaceChrome(): PlaceChrome | null {
  return useContext(PlaceChromeContext);
}
