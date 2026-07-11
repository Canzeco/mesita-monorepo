/** Clip layer for animated swipe cards — radius + overflow on the transformed node. */
export const SWIPE_CARD_CLIP = "overflow-hidden rounded-3xl" as const;

/** Outer shell for PlaceSwipeCardFace (border, shadow, compositing). */
export const SWIPE_CARD_FACE =
  "border-border bg-card shadow-elev relative isolate flex flex-col overflow-hidden rounded-3xl border [transform:translateZ(0)]" as const;

export const SWIPE_CARD_PHOTO_SIZES =
  "(max-width: 768px) 100vw, 420px" as const;

/** TIWC — photo covers the entire card (absolute inset-0, object-cover). */
export const SWIPE_CARD_FULL_BLEED_PHOTO =
  "absolute inset-0 overflow-hidden" as const;

/** TIWC — cover over the full card. */
export const SWIPE_CARD_COVER_PHOTO = "object-cover object-center" as const;

/** WITC — top photo band (cover applies inside this box only). */
export const SWIPE_CARD_WITC_PHOTO_BAND =
  "relative min-h-0 flex-1 overflow-hidden" as const;

/** WITC — reflective strip below the photo band. */
export const SWIPE_CARD_FIELDS_STRIP =
  "relative isolate shrink-0 overflow-hidden rounded-b-3xl" as const;

/**
 * WITC fields target height.
 * We clamp to this so the bottom panel stays compact (title + ~3 tag rows).
 */
export const SWIPE_CARD_WITC_FIELDS_TARGET_H = 152;

/** Fields padding — block flow, top-aligned (no h-full flex). */
export const SWIPE_CARD_FIELDS_INNER =
  "box-border px-3.5 pt-2.5 pb-2.5" as const;
