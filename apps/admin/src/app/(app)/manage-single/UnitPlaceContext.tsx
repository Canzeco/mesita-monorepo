"use client";

import { createContext, useContext } from "react";
import type { AdminPlace } from "./actions";

type UnitPlaceContextValue = {
  projectId: string;
  place: AdminPlace;
  setPlace: (place: AdminPlace) => void;
  reload: () => void;
};

const UnitPlaceContext = createContext<UnitPlaceContextValue | null>(null);

export function UnitPlaceProvider({
  value,
  children,
}: {
  value: UnitPlaceContextValue;
  children: React.ReactNode;
}) {
  return (
    <UnitPlaceContext.Provider value={value}>{children}</UnitPlaceContext.Provider>
  );
}

export function useUnitPlace() {
  const ctx = useContext(UnitPlaceContext);
  if (!ctx) {
    throw new Error("useUnitPlace must be used within UnitPlaceProvider");
  }
  return ctx;
}
