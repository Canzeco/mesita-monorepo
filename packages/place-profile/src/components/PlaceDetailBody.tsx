"use client";

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
// Instagram profile. Callers render their own top bar above this and the
// pinned action bar below it. Optional callbacks keep Reserve, vote, menus,
// and links live; omitting them leaves those controls visible and inert.
// Everything here SCROLLS:
//
//   1. Profile summary — name in page chrome; photo + Google/Instagram/
//      Facebook (that count row hides on Reviews); swipe-style tags; then
//      Save · Contact · Share, then Reserve · Pay (Soon) (MESITA-2321; no pinned bar).
//   2. Not Enriched: the vote panel, straight under the summary — no strip
//      with one lone "Enrich" tab (MESITA-2315); while a Google-only profile
//      is being created, the Creating panel sits there instead
//      (MESITA-2307). Under it, Google's own reviews — the up-to-5 the
//      Details call at create stored — as the same flat list, still no
//      strip (MESITA-2317). Enriched: the sticky strip, Overview · Reviews ·
//      Menu (Soon) · Rewards (Soon), Reviews then holding Apify's 100.
//   3. The active tab's boxes.

export function PlaceDetailBody({
  place,
  actions,
  creating,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
  /** Set while a Google-only profile is being created: the Enrich slot
   *  spins instead of asking for votes (MESITA-2307). */
  creating?: PlaceCreatingView | null;
}) {
  const [tab, setTab] = useState<PlaceTab>(
    place.is_enriched ? "place" : "enrich",
  );

  // Core tabs are not on the strip until Enriched; pin the active key so
  // a stale tab cannot light empty content under Enrich-only.
  // A place Enriched while open lands on Overview, not an empty "enrich".
  const activeTab: PlaceTab = place.is_enriched
    ? tab === "enrich"
      ? "place"
      : tab
    : "enrich";
  return (
    // decision: Pato (2026-10-16) — the name header and the section strip
    // are both white (bg-card). The page wash shows in the content below.
    // pb-4 gives the last section breathing room above whatever footer
    // (nav) the parent layout renders below the scroll area.
    <div className="flex flex-col pb-4">
      <ProfileSummary
        place={place}
        actions={actions}
        showChannelStats={activeTab !== "reviews"}
      />
      {!place.is_enriched && creating && (
        <PlaceCreatingPanel error={creating.error} onRetry={creating.onRetry} />
      )}
      {!place.is_enriched && !creating && (
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
      {!place.is_enriched && place.google_reviews.length > 0 && (
        <div className="px-4 pt-3">
          <GoogleReviewsBox place={place} />
        </div>
      )}
      {place.is_enriched && (
        <div className="flex flex-col gap-3 px-4">
          <PlaceTabBar
            tab={activeTab}
            onChange={setTab}
            enriched={place.is_enriched}
          />
          {activeTab === "place" && (
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
          {activeTab === "reviews" && <GoogleReviewsBox place={place} />}
          {activeTab === "products" && <SoonScreen title="Menu" />}
          {activeTab === "rewards" && <SoonScreen title="Rewards" />}
        </div>
      )}
    </div>
  );
}
