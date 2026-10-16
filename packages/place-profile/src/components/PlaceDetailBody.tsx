"use client";

import { useState } from "react";

import type { PlaceActions } from "../actions";
import { AboutBox } from "./AboutBox";
import type { PlaceDetail } from "../place-detail";

import { LocationBox, HoursBox } from "./place-detail/location-hours";
import { PopularTimesBox } from "./place-detail/popular-times";
import { MediaBox } from "./place-detail/media";
import { ProfileSummary } from "./place-detail/profile-summary";
import { GoogleReviewsBox } from "./place-detail/reviews";
import { PlaceRequestPanelView } from "./place-detail/PlaceRequestPanel";
import { PlaceTabBar, type PlaceTab } from "./place-detail/tabs";
import { SoonScreen } from "./place-detail/soon-screen";
import { DatesBox, LinksBox, TagsBox } from "./place-detail/tags-links-meta";

// Pure presentation for the place detail surface, laid out like an
// Instagram profile. Callers render their own top bar above this and the
// pinned action bar below it. Optional callbacks keep Reserve, vote, menus,
// and links live; omitting them leaves those controls visible and inert.
// Everything here SCROLLS:
//
//   1. Profile summary — name in page chrome; photo + Google/Instagram/
//      Facebook; swipe-style tags. Reserve · Pay · Save are pinned below.
//   2. Sticky tab strip — Enrich only until Enriched, then Overview ·
//      Reviews · Menus (Soon) · Rewards (Soon).
//   3. The active tab's boxes.

export function PlaceDetailBody({
  place,
  actions,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
}) {
  const [tab, setTab] = useState<PlaceTab>(
    place.is_enriched ? "place" : "enrich",
  );

  // Core tabs are not on the strip until Enriched; pin the active key so
  // a stale tab cannot light empty content under Enrich-only.
  const activeTab: PlaceTab = place.is_enriched ? tab : "enrich";
  return (
    // decision: Pato — white profile-summary header vs pink tab body for
    // contrast. Summary sits on bg-card; tabs + content keep bg-background.
    // pb-4 gives the last section breathing room above whatever footer
    // (nav) the parent layout renders below the scroll area.
    <div className="flex flex-col pb-4">
      <ProfileSummary place={place} />
      <div className="flex flex-col gap-3 px-4">
        <PlaceTabBar
          tab={activeTab}
          onChange={setTab}
          enriched={place.is_enriched}
        />
        {activeTab === "enrich" && !place.is_enriched && (
          <PlaceRequestPanelView
            count={actions?.request?.count ?? place.request_count}
            threshold={actions?.request?.threshold ?? place.request_threshold}
            requested={actions?.request?.requested ?? place.requested}
            enriching={actions?.request?.enriching ?? place.is_enriching}
            pending={actions?.request?.pending ?? false}
            error={actions?.request?.error ?? null}
            onRequest={actions?.onRequest}
          />
        )}
        {activeTab === "place" && place.is_enriched && (
          <>
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
        {activeTab === "reviews" && place.is_enriched && (
          <GoogleReviewsBox place={place} />
        )}
        {activeTab === "products" && place.is_enriched && (
          <SoonScreen title="Menus" />
        )}
        {activeTab === "rewards" && place.is_enriched && (
          <SoonScreen title="Rewards" />
        )}
      </div>
    </div>
  );
}
