"use client";

import { createContext, useContext } from "react";
import type { AdminVenue } from "./actions";

type UnitVenueContextValue = {
  unitId: string;
  venue: AdminVenue;
  setVenue: (venue: AdminVenue) => void;
  reload: () => void;
};

const UnitVenueContext = createContext<UnitVenueContextValue | null>(null);

export function UnitVenueProvider({
  value,
  children,
}: {
  value: UnitVenueContextValue;
  children: React.ReactNode;
}) {
  return (
    <UnitVenueContext.Provider value={value}>{children}</UnitVenueContext.Provider>
  );
}

export function useUnitVenue() {
  const ctx = useContext(UnitVenueContext);
  if (!ctx) {
    throw new Error("useUnitVenue must be used within UnitVenueProvider");
  }
  return ctx;
}
