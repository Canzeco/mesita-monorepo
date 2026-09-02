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
