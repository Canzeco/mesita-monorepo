import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";

import { plain } from "@/lib/storage";

import type { ChipKey } from "./families";
import { readActiveLocation, withDefaultLocation, type ActiveLocation } from "./model";

const NAME = "mesita.location";

type Value = {
  /** Undefined until the device's storage has answered. */
  location: ActiveLocation | null | undefined;
  choose: (location: ActiveLocation) => void;
  /** The chip Home shows; the Categories window writes it too. */
  chip: ChipKey;
  selectChip: (chip: ChipKey) => void;
};

const Context = createContext<Value | null>(null);

/** Home's choices, provided at the root: Home reads them, the Location and
 *  Categories windows write them. */
export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocation] = useState<ActiveLocation | null | undefined>(undefined);
  const [chip, selectChip] = useState<ChipKey>("near");
  useEffect(() => {
    let live = true;
    plain
      .get(NAME)
      .catch(() => null)
      .then((raw) => {
        if (!live) return;
        const stored = readActiveLocation(raw);
        const next = withDefaultLocation(stored);
        setLocation((chosen) => (chosen === undefined ? next : chosen));
        if (!stored) plain.set(NAME, JSON.stringify(next)).catch(() => undefined);
      });
    return () => {
      live = false;
    };
  }, []);
  const choose = useCallback((next: ActiveLocation) => {
    setLocation(next);
    plain.set(NAME, JSON.stringify(next)).catch(() => undefined);
  }, []);
  return <Context value={{ location, choose, chip, selectChip }}>{children}</Context>;
}

export function useActiveLocation(): Value {
  const value = use(Context);
  if (!value) throw new Error("LocationProvider is missing at the root");
  return value;
}
