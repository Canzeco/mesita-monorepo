"use client";

import type { RefObject } from "react";
import { cn } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";
import { isSplitLayout, type SwipeCardLayoutMode } from "@/lib/swipe-card-layout";
import { SwipeCardInfo } from "./SwipeCardInfo";
import { SWIPE_CARD_FIELDS_INNER } from "./swipe-card-styles";

/** Hidden sizing clone — same inner node as SwipeCardFieldsLayer. */
export function SwipeCardFieldsMeasure({
  venue,
  measureRef,
}: {
  venue: Venue;
  measureRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 opacity-0"
      aria-hidden
    >
      <div ref={measureRef} className={SWIPE_CARD_FIELDS_INNER}>
        <SwipeCardInfo venue={venue} compact />
      </div>
    </div>
  );
}

/**
 * One fields tree for TIWC and WITC.
 * WITC — text over the blue strip (blue is in the photo slide).
 * TIWC — gradient scrim over the full-bleed photo.
 */
export function SwipeCardFieldsLayer({
  venue,
  mode,
  fieldsHeight,
}: {
  venue: Venue;
  mode: SwipeCardLayoutMode;
  fieldsHeight: number;
}) {
  const split = isSplitLayout(mode);

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-x-0 bottom-0 z-10",
        !split && "bg-gradient-to-t from-black/70 via-black/35 to-transparent pt-16",
      )}
      style={split ? { height: Math.max(fieldsHeight, 1) } : undefined}
    >
      <div className={SWIPE_CARD_FIELDS_INNER}>
        <SwipeCardInfo venue={venue} compact />
      </div>
    </div>
  );
}
