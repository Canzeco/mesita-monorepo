"use client";

import { useState } from "react";

import { AboutBox } from "@/components/consumer/AboutBox";
import type { PlaceDetail } from "@/lib/mock/place";

import { LocationBox, HoursBox } from "./place-detail/location-hours";
import { MediaBox } from "./place-detail/media";
import { MenusBox } from "./place-detail/menus";
import { ProfileSummary } from "./place-detail/profile-summary";
import { GoogleReviewsBox, ReviewsSummaryBox } from "./place-detail/reviews";
import { PlaceRequestPanel } from "./place-detail/PlaceRequestPanel";
import { PlaceTabBar, type PlaceTab } from "./place-detail/tabs";
import { DatesBox, LinksBox, TagsBox } from "./place-detail/tags-links-meta";

// Pure presentation for the place detail surface, laid out like an
// Instagram profile. The two callers (full page at /place/[id] and the
// intercepted modal at @modal/(.)place/[id]) each render their own top
// bar (back + place name + ⋯) above this and the pinned PlaceActionBar
// (Reserve) below it. Everything here SCROLLS:
//
//   1. Profile summary — name in page chrome; photo + Google/Instagram/
//      Facebook; swipe-style tags; then Save · Contact · Share.
//   2. Sticky tab strip — Enrich only until Enriched, then Overview ·
//      Reviews · Menus.
//   3. The active tab's boxes.

export function PlaceDetailBody({ place }: { place: PlaceDetail }) {
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
          <PlaceRequestPanel place={place} />
        )}
        {activeTab === "place" && place.is_enriched && (
          <>
            <MediaBox place={place} />
            {/* decision: Pato — Location first, then Time stacked (not side by side) */}
            <LocationBox place={place} />
            <HoursBox place={place} />
            <LinksBox place={place} />
            <AboutBox text={place.long_description} />
            <TagsBox place={place} />
            <DatesBox place={place} />
          </>
        )}
        {/* The outside channels' numbers first, then Google's own reviews as
            the one source with cards to read. */}
        {activeTab === "reviews" && place.is_enriched && (
          <>
            <ReviewsSummaryBox place={place} />
            <GoogleReviewsBox place={place} />
          </>
        )}
        {activeTab === "products" && place.is_enriched && (
          <MenusBox place={place} />
        )}
      </div>
    </div>
  );
}
