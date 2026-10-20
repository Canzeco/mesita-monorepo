"use client";

import type React from "react";

import type { PlaceActions, PlaceCreatingView } from "../actions";
import { AboutBox } from "./AboutBox";
import type { PlaceDetail } from "../place-detail";

import { PlaceHero, PlaceTitle } from "./place-detail/hero";
import { HoursSection, LocationSection } from "./place-detail/location-hours";
import { LinksSection } from "./place-detail/links";
import { ProfileActions, ReserveBar } from "./place-detail/ProfileActions";
import { ReviewsSection } from "./place-detail/reviews";
import { PlaceCreatingPanel } from "./place-detail/PlaceCreatingPanel";
import { PlaceRequestPanelView } from "./place-detail/PlaceRequestPanel";

// The place screen, as ONE scroll shaped like OpenTable/Resy (MESITA-2441,
// Pato 2026-10-19: "Place Profile still looks like shit"). There are no tabs
// and nothing marked Soon; Menu and Rewards are not on the screen.
//
//   1. Photo carousel, full bleed.
//   2. Name; family · price · distance · rating; then the SOCIAL SLOT
//      (`social`, empty until MESITA-2442 passes "Perdón and 3 others saw
//      this"). See PlaceTitle.
//   3. Save · Share · Directions, an icon row.
//   4. Not Enriched: the Enrich vote (or the Creating panel while a
//      Google-only profile is being created, MESITA-2307).
//   5. About → Hours (today first, collapsible) → Location (map) →
//      Reviews (3 + See all) → Links. Each section hides when empty.
//   6. Reserve, the one primary button, sticky to the bottom of whichever
//      scroller holds this body.
//
// Pure presentation: callers own the scroller and any top bar. Omitted
// callbacks leave their controls visible and inert (the admin preview).

export function PlaceDetailBody({
  place,
  actions,
  creating,
  social,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
  /** Set while a Google-only profile is being created: the Enrich slot
   *  spins instead of asking for votes (MESITA-2307). */
  creating?: PlaceCreatingView | null;
  /** The social line under the title (MESITA-2442). */
  social?: React.ReactNode;
}) {
  return (
    <div className="bg-card flex min-h-full flex-col">
      <PlaceHero place={place} />
      <PlaceTitle place={place} social={social} />
      <ProfileActions place={place} actions={actions} />
      {!place.is_enriched && creating && (
        <div className="border-border border-t">
          <PlaceCreatingPanel error={creating.error} onRetry={creating.onRetry} />
        </div>
      )}
      {!place.is_enriched && !creating && (
        <div className="border-border border-t">
          <PlaceRequestPanelView
            count={actions?.request?.count ?? place.request_count}
            threshold={actions?.request?.threshold ?? place.request_threshold}
            requested={actions?.request?.requested ?? place.requested}
            enriching={actions?.request?.enriching ?? place.is_enriching}
            pending={actions?.request?.pending ?? false}
            error={actions?.request?.error ?? null}
            onRequest={actions?.onRequest}
          />
        </div>
      )}
      <AboutBox text={place.long_description} tags={place.tags} />
      <HoursSection place={place} />
      <LocationSection place={place} onOpenLink={actions?.onOpenLink} />
      <ReviewsSection place={place} />
      <LinksSection place={place} onOpenLink={actions?.onOpenLink} />
      {/* Pushes Reserve to the bottom when the content is short. */}
      <div className="flex-1" />
      <ReserveBar place={place} actions={actions} />
    </div>
  );
}
