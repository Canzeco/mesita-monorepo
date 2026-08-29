"use client";

import { useState } from "react";

import { AboutBox } from "@/components/consumer/AboutBox";
import {
  apiFetchPlaceActivity,
  EMPTY_PLACE_ACTIVITY,
  type PlaceActivity,
} from "@/lib/api/place-activity";
import type { PlaceDetail } from "@/lib/mock/place";
import { useBrowserSupabase } from "@/lib/supabase/browser";
import { errMsg } from "@/lib/utils";

import {
  FeaturedOrdersBox,
  FeaturedReservationsBox,
  FeaturedVisitsBox,
  InstagramStoriesBox,
} from "./place-detail/activity";
import { LocationBox, HoursBox } from "./place-detail/location-hours";
import { MediaBox } from "./place-detail/media";
import { MenusBox } from "./place-detail/menus";
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
import { PlaceRequestPanel } from "./place-detail/PlaceRequestPanel";
import { PlaceTabBar, type PlaceTab } from "./place-detail/tabs";
import {
  DatesBox,
  LinksBox,
  TagsBox,
  VerificationBox,
} from "./place-detail/tags-links-meta";

// Pure presentation for the place detail surface, laid out like an
// Instagram profile. The two callers (full page at /place/[id] and the
// intercepted modal at @modal/(.)place/[id]) each render their own top
// bar (back + place name + ⋯) above this and the pinned PlaceActionBar
// (Visit · Order · Reserve) below it. Everything here SCROLLS:
//
//   1. Profile summary — name in page chrome; photo + Google/Instagram/
//      Facebook; swipe-style tags; then Save · Contact · Share.
//   2. Sticky tab strip — Enrich only until Enriched, then Overview ·
//      Reviews · Menus · Rewards.
//   3. The active tab's boxes.

export function PlaceDetailBody({ place }: { place: PlaceDetail }) {
  const [tab, setTab] = useState<PlaceTab>(
    place.is_enriched ? "place" : "enrich",
  );
  const supabase = useBrowserSupabase();
  // Guest activity (stories · visits · reservations) is fetched the first time
  // Reviews is opened, not with the page — see lib/api/place-activity.ts for
  // why it isn't folded into the server-rendered place payload.
  //
  // Kicked off from the tab handler rather than an effect: React 19 flags
  // setState-in-effect, and the tab can only be reached by a tap, so the
  // event IS the trigger.
  const [activity, setActivity] = useState<PlaceActivity>(
    EMPTY_PLACE_ACTIVITY,
  );
  const [activityState, setActivityState] = useState<
    "idle" | "loading" | "done"
  >("idle");

  const onTabChange = (next: PlaceTab) => {
    setTab(next);
    if (next !== "reviews" || activityState !== "idle") return;
    setActivityState("loading");
    void apiFetchPlaceActivity(supabase, place.id)
      .then(setActivity)
      // A failed rail must not take the tab down: the reviews above it are
      // already rendered from the page payload, and each activity box falls
      // back to its own empty state.
      .catch((err) => {
        console.error(
          "[PlaceDetailBody] place activity failed:",
          errMsg(err, "place activity failed"),
        );
      })
      .finally(() => setActivityState("done"));
  };

  const activityLoading = activityState === "loading";
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
          onChange={onTabChange}
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
            <AboutBox
              text={place.long_description}
              name={place.name}
            />
            <TagsBox place={place} />
            <VerificationBox place={place} />
            <DatesBox place={place} />
          </>
        )}
        {/* decision: Pato (live, MESITA-1147) — six rails in exactly this
            order: the three review sources (Mesita's own first, Google's as
            context), then the three Featured feeds. Each box owns its own
            sort set. Orders keeps its slot between Visits and Reservations
            even though ordering isn't built — the box states that itself. */}
        {activeTab === "reviews" && place.is_enriched && (
          <>
            <ReviewsSummaryBox place={place} />
            <MesitaReviewsBox place={place} />
            <GoogleReviewsBox place={place} />
            <InstagramStoriesBox
              stories={activity.stories}
              loading={activityLoading}
            />
            <FeaturedVisitsBox
              visits={activity.visits}
              loading={activityLoading}
            />
            <FeaturedOrdersBox />
            <FeaturedReservationsBox
              reservations={activity.reservations}
              loading={activityLoading}
            />
          </>
        )}
        {activeTab === "products" && place.is_enriched && (
          <MenusBox place={place} />
        )}
        {/* Reward always renders on its tab. Web listings and rate-less
            partners get a "doesn't offer rewards" state inside RewardsBox
            rather than an empty tab, so all three cases (web / partner-no-
            rate / partner-with-reward) are explicit to the guest. */}
        {activeTab === "rewards" && place.is_enriched && (
          <RewardsBox place={place} />
        )}
      </div>
    </div>
  );
}
