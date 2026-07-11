"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { AdminPlace } from "./actions";

type UnitPlaceContextValue = {
  projectId: string;
  place: AdminPlace;
  setPlace: (place: AdminPlace) => void;
  reload: () => void;
  /** Any Place/Products box has unsaved edits. */
  isDirty: boolean;
  setSectionDirty: (section: string, dirty: boolean) => void;
  /** Register a reset callback invoked when the operator discards dirty edits. */
  registerDiscardHandler: (section: string, handler: (() => void) | null) => void;
  requestDiscard: () => void;
};

const UnitPlaceContext = createContext<UnitPlaceContextValue | null>(null);

export function UnitPlaceProvider({
  projectId,
  place,
  setPlace,
  reload,
  children,
}: {
  projectId: string;
  place: AdminPlace;
  setPlace: (place: AdminPlace) => void;
  reload: () => void;
  children: ReactNode;
}) {
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});
  const discardHandlers = useRef<Record<string, () => void>>({});

  const setSectionDirty = useCallback((section: string, dirty: boolean) => {
    setDirtyMap((prev) => {
      if (Boolean(prev[section]) === dirty) return prev;
      if (!dirty) {
        const next = { ...prev };
        delete next[section];
        return next;
      }
      return { ...prev, [section]: true };
    });
  }, []);

  const registerDiscardHandler = useCallback(
    (section: string, handler: (() => void) | null) => {
      if (!handler) {
        delete discardHandlers.current[section];
        return;
      }
      discardHandlers.current[section] = handler;
    },
    [],
  );

  const requestDiscard = useCallback(() => {
    for (const handler of Object.values(discardHandlers.current)) {
      handler();
    }
    setDirtyMap({});
  }, []);

  const isDirty = useMemo(
    () => Object.values(dirtyMap).some(Boolean),
    [dirtyMap],
  );

  const value = useMemo(
    () => ({
      projectId,
      place,
      setPlace,
      reload,
      isDirty,
      setSectionDirty,
      registerDiscardHandler,
      requestDiscard,
    }),
    [
      projectId,
      place,
      setPlace,
      reload,
      isDirty,
      setSectionDirty,
      registerDiscardHandler,
      requestDiscard,
    ],
  );

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
