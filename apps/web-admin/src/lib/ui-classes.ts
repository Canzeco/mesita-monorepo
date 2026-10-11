// Shared Tailwind class strings for form primitives + feedback boxes.

export const ERROR_BOX_CLASS =
  "rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive";

/**
 * The identity column of a wide record table, pinned to the left edge while
 * the fact columns scroll past it on a phone — a thirteen-column table has no
 * anchor otherwise. Static again from `sm`, where the table fits its column.
 *
 * The backgrounds are the point: a sticky cell slides OVER its neighbours, so
 * a translucent tint would let them read through. Body cells sit on the card,
 * so `bg-card` is exact; the header's `bg-muted/30` has to be flattened
 * against the card to get an opaque twin of the same colour.
 */
export const STICKY_COL_HEAD =
  "sticky left-0 z-20 bg-[color-mix(in_oklab,var(--color-muted)_30%,var(--color-card))] sm:static sm:bg-transparent";

export const STICKY_COL_CELL =
  "sticky left-0 z-10 bg-card sm:static sm:bg-transparent";

// ── The business console's button vocabulary ───────────────────────────────
// The place surface Single Place renders (MESITA-2086) reaches these four by
// alias. They are the business console's own strings, kept verbatim when
// MESITA-2089 deleted web-business, so the cards still render its pill.
export const FOCUS_RING_CLASS =
  "outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const TOUCH_TARGET_CLASS =
  "relative after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:w-full after:-translate-y-1/2 after:content-['']";

export const PILL_BUTTON_CLASS = `bg-foreground text-paper inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition hover:opacity-90 disabled:opacity-60 ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`;

export const CTA_BUTTON_CLASS = `bg-foreground text-paper inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 ${FOCUS_RING_CLASS} ${TOUCH_TARGET_CLASS}`;
