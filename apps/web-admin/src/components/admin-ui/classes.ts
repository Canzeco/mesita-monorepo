// The kit's only class-string module (MESITA-3948). Every other file in the
// console takes chrome from a kit component; these strings exist for the few
// places a component cannot reach (a sticky table column, the rail's ring).

/** Keyboard focus: a 2px ring offset from the surface. Every kit control. */
export const FOCUS_RING_CLASS =
  "outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** The same ring on a dark surface (the rail): the offset takes the surface's
 *  colour, because `background` would draw a pale halo around it. */
export const FOCUS_RING_ON_DARK_CLASS =
  "outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-foreground";

/** A 44px hit area around a smaller visual control, drawn by `::after`. */
export const TOUCH_TARGET_CLASS =
  "relative after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:w-full after:-translate-y-1/2 after:content-['']";

/** The card surface: white, hairline, rounded-2xl, no shadow (one skin). */
export const CARD_SURFACE_CLASS = "border-border bg-card rounded-2xl border";

/** A card's box: the surface, 16px in (24px from sm). */
export const CARD_CLASS = `${CARD_SURFACE_CLASS} p-4 sm:p-6`;

/** Popovers, map overlays and the confirm dialog: the only floating shadow. */
export const OVERLAY_SURFACE_CLASS = "bg-card border-border rounded-2xl border shadow-elev";

/** The phone drawer that holds the rail: shadow only, no radius or border. */
export const DRAWER_SURFACE_CLASS = "shadow-elev";

/** One skeleton bone: grey, pulsing, rounded-lg. */
export const BONE_CLASS = "bg-muted animate-pulse rounded-lg";

/**
 * The identity column of a wide record table, pinned to the left edge while
 * the fact columns scroll past it on a phone. Static again from `sm`. The
 * header's `bg-muted/30` is flattened against the card so the sticky cell is
 * opaque when it slides over its neighbours.
 */
export const STICKY_COL_HEAD =
  "sticky left-0 z-20 bg-[color-mix(in_oklab,var(--color-muted)_30%,var(--color-card))] sm:static sm:bg-transparent";

export const STICKY_COL_CELL = "sticky left-0 z-10 bg-card sm:static sm:bg-transparent";
