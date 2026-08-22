"use client";

import { useEffect } from "react";
import { usePlaceContext } from "./PlaceContext";

/**
 * Registers a section's draft dirty flag + discard reset with PlaceContext.
 * Shared by Place/Products and Settings SaveBar cards.
 */
export function useSectionDirty(
  section: string,
  dirty: boolean,
  onDiscard: () => void,
): void {
  const { setSectionDirty, registerDiscardHandler } = usePlaceContext();

  useEffect(() => {
    setSectionDirty(section, dirty);
    return () => setSectionDirty(section, false);
  }, [section, dirty, setSectionDirty]);

  useEffect(() => {
    registerDiscardHandler(section, onDiscard);
    return () => registerDiscardHandler(section, null);
  }, [section, registerDiscardHandler, onDiscard]);
}
