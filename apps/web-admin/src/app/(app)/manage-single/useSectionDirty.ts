"use client";

import { useEffect } from "react";
import { useUnitPlace } from "./UnitPlaceContext";

/**
 * Registers a section's draft dirty flag + discard reset with UnitPlaceContext.
 * Shared by Place/Products and Settings SaveBar cards.
 */
export function useSectionDirty(
  section: string,
  dirty: boolean,
  onDiscard: () => void,
): void {
  const { setSectionDirty, registerDiscardHandler } = useUnitPlace();

  useEffect(() => {
    setSectionDirty(section, dirty);
    return () => setSectionDirty(section, false);
  }, [section, dirty, setSectionDirty]);

  useEffect(() => {
    registerDiscardHandler(section, onDiscard);
    return () => registerDiscardHandler(section, null);
  }, [section, registerDiscardHandler, onDiscard]);
}
