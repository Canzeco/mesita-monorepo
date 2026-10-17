"use client";

import { ArrowLeft } from "lucide-react";

import type { PlaceActions } from "../actions";
import { inertButtonProps } from "../actions";
import type { PlaceDetail } from "../place-detail";
import { PlaceActionBar } from "./place-detail/PlaceActionBar";
import { PlaceDetailBody } from "./PlaceDetailBody";
import { PlaceDetailTitle } from "./PlaceDetailTitle";

// Header, scrolling body, pinned Reserve · Pay (Soon). Save · Contact ·
// Share sit in the profile summary. The consumer page and the admin phone
// both render this. Omitted callbacks stay visible and do nothing. Pay is Soon.
export function PlaceProfile({
  place,
  onBack,
  scrollLabel,
  actions,
}: {
  place: PlaceDetail;
  onBack?: () => void;
  /** When set, the scroll region is in the tab order under this name. */
  scrollLabel?: string;
  actions?: PlaceActions;
}) {
  return (
    <div className="bg-background relative flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="bg-card z-20 flex shrink-0 items-center gap-2 px-3 py-3">
        <button
          type="button"
          aria-label="Back"
          className="bg-card text-foreground border-border hover:bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition"
          {...(onBack ? { onClick: onBack } : inertButtonProps(false))}
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <PlaceDetailTitle placeName={place.name} />
        <div className="h-9 w-9 shrink-0" aria-hidden />
      </header>
      <div
        className="min-h-0 flex-1 overflow-y-auto"
        tabIndex={scrollLabel ? 0 : undefined}
        aria-label={scrollLabel}
      >
        <PlaceDetailBody place={place} actions={actions} />
      </div>
      <PlaceActionBar place={place} onReserve={actions?.onReserve} />
    </div>
  );
}
