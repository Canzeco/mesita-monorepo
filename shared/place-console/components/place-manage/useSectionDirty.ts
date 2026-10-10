"use client";

import { useEffect, useRef } from "react";
import type { AdminPlace } from "./actions";
import { usePlaceContext, type PatchResult } from "./PlaceContext";

/**
 * Registers a section's draft dirty flag + discard reset with PlaceContext.
 * Shared by Profile/Menus and Controls cards.
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

/**
 * Joins a section to the ONE page-level save (see PlaceContext's SectionSaver
 * note for why there is only one).
 *
 * `getPatch` and `onSaved` are re-created on every render by the caller, which
 * is what makes them able to read current draft state. Registering them
 * directly would re-register on every keystroke, so a STABLE delegate is
 * registered once per section and reads the latest pair through a ref. The
 * effect that keeps the ref current runs after every render, so by the time
 * anything can call saveAll — a click, i.e. a later tick — it is current.
 */
export function useSectionSaver(
  section: string,
  dirty: boolean,
  getPatch: () => PatchResult,
  onSaved: (fresh: AdminPlace) => void,
  onDiscard: () => void,
): void {
  const { registerSaver } = usePlaceContext();
  useSectionDirty(section, dirty, onDiscard);

  const latest = useRef({ getPatch, onSaved });
  useEffect(() => {
    latest.current = { getPatch, onSaved };
  });

  useEffect(() => {
    registerSaver(section, {
      getPatch: () => latest.current.getPatch(),
      onSaved: (fresh) => latest.current.onSaved(fresh),
    });
    return () => registerSaver(section, null);
  }, [section, registerSaver]);
}
