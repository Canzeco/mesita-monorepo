"use client";

// A page's actions in the page header, top right (MESITA-4555, Pato: "IN THE
// HEADER, NOT THE BODY"). PlaceTabTitle renders the slot; a page portals its
// buttons into it, so the layout's header stays one component.
import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

export const HEADER_ACTIONS_ID = "place-header-actions";

const noop = () => () => {};

export function HeaderActions({ children }: { children: React.ReactNode }) {
  const slot = useSyncExternalStore(
    noop,
    () => document.getElementById(HEADER_ACTIONS_ID),
    () => null,
  );
  return slot ? createPortal(children, slot) : null;
}
