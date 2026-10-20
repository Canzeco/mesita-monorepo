"use client";

import type React from "react";
import { ArrowLeft } from "lucide-react";

import type { PlaceActions, PlaceCreatingView } from "../actions";
import { inertButtonProps } from "../actions";
import type { PlaceDetail } from "../place-detail";
import { PlaceDetailBody } from "./PlaceDetailBody";

// The place screen with its own scroller: Back floats over the photo, the
// way OpenTable and Resy do it, and the name is the page's title under the
// carousel (MESITA-2441). Reserve is pinned inside the body. The consumer
// page and the admin phone both render this.
export function PlaceProfile({
  place,
  onBack,
  scrollLabel,
  actions,
  creating,
  social,
}: {
  place: PlaceDetail;
  onBack?: () => void;
  /** When set, the scroll region is in the tab order under this name. */
  scrollLabel?: string;
  actions?: PlaceActions;
  /** A Google-only profile being created (MESITA-2307). */
  creating?: PlaceCreatingView | null;
  /** The social line under the title (MESITA-2442). */
  social?: React.ReactNode;
}) {
  return (
    <div className="bg-card relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <button
        type="button"
        aria-label="Back"
        className="bg-card/95 text-foreground absolute top-3 left-3 z-30 flex h-11 w-11 items-center justify-center rounded-full shadow-md transition hover:bg-card"
        {...(onBack ? { onClick: onBack } : inertButtonProps(false))}
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
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
        />
      </div>
    </div>
  );
}
