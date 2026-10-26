"use client";

import type React from "react";

import type { PlaceActions, PlaceCreatingView } from "../actions";
import type { PlaceTab } from "./place-detail/tabs";
import type { PlaceDetail } from "../place-detail";
import { PlaceDetailBody } from "./PlaceDetailBody";
import { PlaceTopBar } from "./PlaceTopBar";

// Header, then the scrolling body. There is no pinned bar: the one action
// row (the heart, Reserve · Directions, then Contact) sits in the
// profile summary (MESITA-2321, reshaped MESITA-2618/2619). The consumer
// page and the admin phone both render this. Omitted callbacks stay visible
// and do nothing.
//
// THE TOP BAR IS INSTAGRAM'S PROFILE BAR (PlaceTopBar, shared with the
// consumer's in-app slide-over since MESITA-2627) (Pato, MESITA-2619: "make the
// header look more instagramish, with the three dots and all that shit, i
// mean, the name"): a bare chevron, the name in bold sans at its left, and
// the three dots at the right edge. It replaced a bordered back square and
// a centred serif title.
//
// The three dots open the host's menu of the place's actions (onMore; Pato,
// MESITA-2692: "not only to report"). They reported alone (MESITA-2684) and
// shared before that, twice over with the Share tile (ProfileActions).
export function PlaceProfile({
  place,
  onBack,
  scrollLabel,
  actions,
  creating,
  social,
  boost,
  openTab,
}: {
  place: PlaceDetail;
  onBack?: () => void;
  /** When set, the scroll region is in the tab order under this name. */
  scrollLabel?: string;
  actions?: PlaceActions;
  /** A Google-only profile being created (MESITA-2307). */
  creating?: PlaceCreatingView | null;
  /** Social v1's line (MESITA-2442), under the chips like Instagram's
   *  "Followed by". */
  social?: React.ReactNode;
  /** The Boost tab's body (MESITA-2789); see PlaceDetailBody. */
  boost?: React.ReactNode;
  /** A tab the host asks to show (MESITA-2797); see PlaceDetailBody. */
  openTab?: { tab: PlaceTab; key: number } | null;
}) {
  return (
    <div className="bg-background relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <PlaceTopBar
        name={place.name}
        enriched={place.is_enriched}
        onBack={onBack}
        onMore={actions?.onMore}
      />
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        tabIndex={scrollLabel ? 0 : undefined}
        aria-label={scrollLabel}
      >
        <PlaceDetailBody
          place={place}
          actions={actions}
          creating={creating}
          social={social}
          boost={boost}
          openTab={openTab}
        />
      </div>
    </div>
  );
}
