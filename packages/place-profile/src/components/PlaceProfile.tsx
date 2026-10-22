"use client";

import type React from "react";
import { ArrowLeft } from "lucide-react";

import type { PlaceActions, PlaceCreatingView } from "../actions";
import { inertButtonProps } from "../actions";
import type { PlaceDetail } from "../place-detail";
import { PlaceDetailBody } from "./PlaceDetailBody";
import { PlaceDetailTitle } from "./PlaceDetailTitle";

// Header, then the scrolling body. There is no pinned bar: the one action
// row (Reserve, then Favorite · Contact · Share as icons) sits in the
// profile summary (MESITA-2321, reshaped MESITA-2618). The consumer page and
// the admin phone both render this. Omitted callbacks stay visible and do
// nothing.
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
  /** Social v1's line (MESITA-2442), under the chips like Instagram's
   *  "Followed by". */
  social?: React.ReactNode;
}) {
  return (
    <div className="bg-background relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="bg-card z-20 flex shrink-0 items-center gap-2 px-3 py-3">
        <button
          type="button"
          aria-label="Back"
          className="bg-card text-foreground border-border hover:bg-muted flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition"
          {...(onBack ? { onClick: onBack } : inertButtonProps(false))}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <PlaceDetailTitle placeName={place.name} enriched={place.is_enriched} />
        <div className="h-11 w-11 shrink-0" aria-hidden />
      </header>
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
