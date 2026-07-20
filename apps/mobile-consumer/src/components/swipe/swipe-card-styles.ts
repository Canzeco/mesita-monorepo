/** Clip layer for animated swipe cards — radius + overflow on the transformed node. */
export const SWIPE_CARD_CLIP = 'overflow-hidden rounded-3xl' as const;

/** Outer shell for PlaceSwipeCard face (border + radius). */
export const SWIPE_CARD_FACE =
  'relative flex-1 overflow-hidden rounded-3xl border border-border bg-card' as const;

/** WITC fields target height (title + ~3 tag rows). */
export const SWIPE_CARD_WITC_FIELDS_TARGET_H = 152;

/** Fields padding — block flow, top-aligned. */
export const SWIPE_CARD_FIELDS_INNER = 'px-3.5 pt-2.5 pb-2.5' as const;
