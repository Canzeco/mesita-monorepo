"use client";

import type React from "react";
import { useState } from "react";

import type { PlaceActions, PlaceCreatingView } from "../actions";
import { AboutBox } from "./AboutBox";
import type { PlaceDetail } from "../place-detail";

import { LocationBox, HoursBox } from "./place-detail/location-hours";
import { PopularTimesBox } from "./place-detail/popular-times";
import { MediaBox } from "./place-detail/media";
import { ProfileSummary } from "./place-detail/profile-summary";
import { GoogleReviewsBox } from "./place-detail/reviews";
import { PlaceCreatingPanel } from "./place-detail/PlaceCreatingPanel";
import { PlaceRequestPanelView } from "./place-detail/PlaceRequestPanel";
import { PlaceTabBar, type PlaceTab } from "./place-detail/tabs";
import { SoonScreen } from "./place-detail/soon-screen";
import { DatesBox, LinksBox, TagsBox } from "./place-detail/tags-links-meta";

// Pure presentation for the place detail surface, laid out like an
// Instagram profile. Callers render their own top bar above this; there is
// no pinned action bar below it. Optional callbacks keep Reserve, vote,
// menus, and links live; omitting them leaves those controls visible and
// inert.
// Everything here SCROLLS:
//
//   1. Profile summary — name in page chrome; photo + Google/Instagram/
//      Facebook (on every tab, MESITA-2334); swipe-style tags; then
//      one row of actions: Reserve, then Favorite · Contact · Share as
//      icons (MESITA-2618; no pinned bar).
//   2. The sticky strip, Overview · Reviews · Products (Soon) · Rewards (Soon),
//      for every place (MESITA-2332). Not Enriched: Overview opens with the
//      vote panel — or the Creating panel while a Google-only profile is
//      being created (MESITA-2307) — and Reviews holds Google's up-to-5 from
//      the create-time Details call (MESITA-2317). Enriched: Reviews holds
//      Apify's 100.
//   3. The active tab's boxes.

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
  /** Social v1's line (MESITA-2442), in the profile summary. */
  social?: React.ReactNode;
}) {
  const [tab, setTab] = useState<PlaceTab>("place");
  return (
    // decision: Pato (2026-10-16) — the name header and the section strip
    // are both white (bg-card). The page wash shows in the content below.
    // pb-4 gives the last section breathing room above whatever footer
    // (nav) the parent layout renders below the scroll area.
    <div className="flex flex-col pb-4">
      <ProfileSummary place={place} actions={actions} social={social} />
      <div className="flex flex-col gap-3 px-4">
        <PlaceTabBar tab={tab} onChange={setTab} />
          {tab === "place" && (
            <>
              {!place.is_enriched && creating && (
                <div className="-mx-4 -mt-3">
                  <PlaceCreatingPanel error={creating.error} onRetry={creating.onRetry} />
                </div>
              )}
              {!place.is_enriched && !creating && (
                <div className="-mx-4 -mt-3">
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
              <MediaBox place={place} />
              {/* decision: Pato — Location first, then Time stacked (not side by side) */}
              <LocationBox place={place} onOpenLink={actions?.onOpenLink} />
              <HoursBox place={place} />
              <PopularTimesBox place={place} />
              <LinksBox place={place} onOpenLink={actions?.onOpenLink} />
              <AboutBox text={place.long_description} />
              <TagsBox place={place} />
              <DatesBox place={place} />
            </>
          )}
          {tab === "reviews" && <GoogleReviewsBox place={place} />}
          {tab === "products" && <SoonScreen title="Products" />}
          {tab === "rewards" && <SoonScreen title="Rewards" />}
      </div>
    </div>
  );
}
