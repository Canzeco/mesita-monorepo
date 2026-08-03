"use client";

import { useState } from "react";

import { AboutBox } from "@/components/consumer/AboutBox";
import type { PlaceDetail } from "@/lib/mock/place";

import { LocationBox, HoursBox } from "./place-detail/location-hours";
import { MediaBox } from "./place-detail/media";
import { ProductsBox } from "./place-detail/products";
import { ProfileSummary } from "./place-detail/profile-summary";
// decision: Pato (live, 2026-08-03) — the Reviews tab carries all three boxes
// again: the cross-channel summary, Google's reviews, then Mesita's own. The
// v5 Google-only cut (MESITA-723) is over, and mobile never stopped rendering
// the full set — this restores web↔mobile parity.
import {
  GoogleReviewsBox,
  MesitaReviewsBox,
  ReviewsSummaryBox,
} from "./place-detail/reviews";
import { RewardsBox } from "./place-detail/rewards";
import { PlaceTabBar, type PlaceTab } from "./place-detail/tabs";
import {
  LinksBox,
  TagsBox,
  VerificationBox,
  LastUpdatedBox,
} from "./place-detail/tags-links-meta";

// Pure presentation for the place detail surface, laid out like an
// Instagram profile. The two callers (full page at /place/[id] and the
// intercepted modal at @modal/(.)place/[id]) each render their own top
// bar (back + place name + ⋯) on top of this. Structure:
//
//   1. Profile summary — name in page chrome; photo + Google/Instagram/
//      Facebook; swipe-style tags; then Save · Contact · Reserve · Share.
//   2. Sticky tab strip — Place · Reviews · Products · Rewards.
//   3. The active tab's boxes.

export function PlaceDetailBody({ place }: { place: PlaceDetail }) {
  const [tab, setTab] = useState<PlaceTab>("place");
  return (
    // decision: Pato — white profile-summary header vs pink tab body for
    // contrast. Summary sits on bg-card; tabs + content keep bg-background.
    // pb-4 gives the last section breathing room above whatever footer
    // (nav) the parent layout renders below the scroll area.
    <div className="flex flex-col pb-4">
      <ProfileSummary place={place} />
      <div className="flex flex-col gap-3 px-4">
        <PlaceTabBar tab={tab} onChange={setTab} />
        {tab === "place" && (
          <>
            <MediaBox place={place} />
            {/* decision: Pato — Location first, then Time stacked (not side by side) */}
            <LocationBox place={place} />
            <HoursBox place={place} />
            <LinksBox place={place} />
            <AboutBox text={place.long_description} name={place.name} />
            <TagsBox place={place} />
            <VerificationBox place={place} />
            <LastUpdatedBox place={place} />
          </>
        )}
        {tab === "reviews" && (
          <>
            <ReviewsSummaryBox place={place} />
            <GoogleReviewsBox place={place} />
            <MesitaReviewsBox place={place} />
          </>
        )}
        {tab === "products" && <ProductsBox place={place} />}
        {/* Reward always renders on its tab. Web listings and rate-less
            partners get a "doesn't offer rewards" state inside RewardsBox
            rather than an empty tab, so all three cases (web / partner-no-
            rate / partner-with-reward) are explicit to the guest. */}
        {tab === "rewards" && <RewardsBox place={place} />}
      </div>
    </div>
  );
}
