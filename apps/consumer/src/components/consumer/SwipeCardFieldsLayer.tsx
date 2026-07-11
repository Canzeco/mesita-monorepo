"use client";

import type { RefObject } from "react";
import type { Place } from "@/lib/api/places";
import {
  isSplitLayout,
  type SwipeCardLayoutMode,
} from "@/lib/swipe-card-layout";
import { SwipeCardInfo } from "./SwipeCardInfo";
import {
  SWIPE_CARD_FIELDS_INNER,
  SWIPE_CARD_WITC_FIELDS_TARGET_H,
} from "./swipe-card-styles";

/** Hidden sizing clone — same inner node as SwipeCardFieldsLayer. */
export function SwipeCardFieldsMeasure({
  place,
  measureRef,
}: {
  place: Place;
  measureRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 -z-10 opacity-0"
      aria-hidden
    >
      <div ref={measureRef} className={SWIPE_CARD_FIELDS_INNER}>
        <SwipeCardInfo place={place} compact />
      </div>
    </div>
  );
}

/**
 * One fields tree for TIWC and WITC.
 * Same bottom-anchored fields in both modes.
 * - TIWC: bottom box background is a subtle dark gradient for readability.
 * - WITC: bottom box background comes from the reflection in the photo layer.
 */
export function SwipeCardFieldsLayer({
  place,
  mode,
  fieldsHeight,
}: {
  place: Place;
  mode: SwipeCardLayoutMode;
  fieldsHeight: number;
}) {
  const split = isSplitLayout(mode);
  const contentHeight = split
    ? Math.max(Math.min(fieldsHeight, SWIPE_CARD_WITC_FIELDS_TARGET_H), 1)
    : Math.max(fieldsHeight, 1);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-10 rounded-b-3xl"
      style={{ height: contentHeight }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
        {!split && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-black/34 to-transparent" />
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0">
        <div className={SWIPE_CARD_FIELDS_INNER}>
          <SwipeCardInfo place={place} compact />
        </div>
      </div>
    </div>
  );
}
