"use client";

import { createContext, useContext } from "react";
import type { MyVenue } from "@/lib/api/venues";

// Carries the per-request unit data (fetched once in the unit layout) down
// to the app bar so it can render the venue switcher without every page
// having to re-plumb props. Consumed by UnitDock.
export type UnitChrome = {
  activeVenueId: string | null;
  venues: MyVenue[];
  isSuperAdmin: boolean;
};

const UnitChromeContext = createContext<UnitChrome | null>(null);

export function UnitChromeProvider({
  value,
  children,
}: {
  value: UnitChrome;
  children: React.ReactNode;
}) {
  return (
    <UnitChromeContext.Provider value={value}>
      {children}
    </UnitChromeContext.Provider>
  );
}

export function useUnitChrome(): UnitChrome | null {
  return useContext(UnitChromeContext);
}
