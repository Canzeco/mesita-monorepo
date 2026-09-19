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
// WHAT SITS OUTSIDE A `Half` RENDERS ON BOTH — so almost nothing may sit
// outside one. Only the product's heading does.
//
// STATE TILES ARE ACTIVITY. They used to be exempt, on the theory that a
// count is "the product's own context" and context belongs on whichever
// screen you are standing on. That was wrong, and Pato caught it on five
// screens at once (MESITA-2003): *"setup is for fucking setup, not analytics
// nor shit."* Setup → Online Reservations led with Upcoming 4 and No-shows 1;
// Setup → Visit Rewards opened on Settled total $7,306. Those are yesterday's
// numbers on the screen you came to change a setting, and a number is not
// context just because it is small and sits in a box.
//
// The on/off tile went with them and is no loss: a product's state is already
// in the badge beside its name at the top of the pane, so the tile was the
// same fact twice, eleven words apart.
//
// THE RULE, with no exception and no third option: if it reports what
// happened, it goes inside `Half label="Activity"`. If it changes what will
// happen, it goes inside `Half label="Manage"`. Nothing else goes outside.
//
// `CapitalView` keeps its tiles outside, and is the one case that fits the
// rule rather than breaking it: What you get / What the guest gets / What it
// is not state the DEAL on offer. That is the product's terms, not its log.
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
