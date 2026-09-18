"use client";

// THE TWO HALVES OF A PRODUCT — and the thing that decides which one you get
// (MESITA-1986).
//
// Pato: *"remember, for all the pages, this is just the fucking setup, not
// notifications activity, that goes in activity."*
//
// Every product view was already written in two labelled halves: `Manage` is
// how the product is configured, `Activity` is what it recorded. Both rendered
// on one screen, which is why Setup → Online Reservations showed a Bookings
// table and Setup → Visit Rewards showed a visit log.
//
// ── ONE COMPONENT, TWO READINGS ────────────────────────────────────────────
//
// `HalfScope` says which half the surface wants and `Half` renders or returns
// null. THE VIEWS ARE UNTOUCHED: a product's setup and its log stay one
// component, so a number shown on both sides cannot disagree with itself —
// which is exactly what two hand-split components would eventually do.
//
// WHAT SITS OUTSIDE A `Half` RENDERS ON BOTH, and that is the rule to write
// down rather than discover: a view's heading and its state tiles are the
// product's own context, and context belongs on whichever screen you are
// standing on. If something should appear on ONE side only, it goes inside the
// matching `Half`. There is no third option and no per-view exception.
//
// NO SCOPE, BOTH HALVES. The standalone `/places/<id>/<view>` addresses render
// a whole view with no provider above them, and they keep working exactly as
// they did — a pasted link and Home's blocker rows both land there.
import { createContext, useContext } from "react";
import { TINY_LABEL_CLASS } from "@/lib/ui-classes";
import type { PlaceHalf } from "@/lib/product-routes";

const HalfCtx = createContext<PlaceHalf | null>(null);

export function HalfScope({
  half,
  children,
}: {
  half: PlaceHalf;
  children: React.ReactNode;
}) {
  return <HalfCtx.Provider value={half}>{children}</HalfCtx.Provider>;
}

/** Which half is being drawn, or null when nothing has said — the standalone
 *  view addresses, where both halves belong. */
export function useHalf(): PlaceHalf | null {
  return useContext(HalfCtx);
}

const WANTS: Record<PlaceHalf, "Manage" | "Activity"> = {
  products: "Manage",
  activity: "Activity",
};

export function Half({
  label,
  children,
}: {
  label: "Manage" | "Activity";
  children: React.ReactNode;
}) {
  const half = useHalf();
  if (half !== null && WANTS[half] !== label) return null;

  // THE LABEL GOES WHEN THE SURFACE IS THE LABEL. On `/setup/<product>` every
  // remaining block is Manage, so a caption reading "MANAGE" is the tab's own
  // name repeated inside the pane. It stays on the standalone addresses, where
  // both halves are on screen and the reader needs telling which is which.
  return (
    <section aria-label={label} className="flex flex-col gap-4">
      {half === null && <p className={TINY_LABEL_CLASS}>{label}</p>}
      {children}
    </section>
  );
}
