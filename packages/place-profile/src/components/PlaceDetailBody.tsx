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
import { PlaceCreateFailedPanel } from "./place-detail/PlaceCreateFailedPanel";
import { NO_BOOST, NO_OVERVIEW, PlaceEmptyScreen } from "./place-detail/empty-screen";
import { PlaceTabBar, type PlaceTab } from "./place-detail/tabs";
import { SoonScreen } from "./place-detail/soon-screen";
import { LinksBox, StatsBox, TagsBox } from "./place-detail/tags-links-meta";

// Pure presentation for the place detail surface, laid out like an
// Instagram profile. Callers render their own top bar above this; there is
// no pinned action bar below it. Optional callbacks keep Reserve, vote,
// menus, and links live; omitting them leaves those controls visible and
// inert.
// Everything here SCROLLS:
//
//   1. Profile summary — name in page chrome; photo + Google/Instagram/
//      Facebook (on every tab, MESITA-2334); swipe-style tags, led by a
//      Creating fact while a Google-only profile is being created
//      (MESITA-2307, MESITA-2679); then one row of actions: the heart,
//      Reserve · Directions, then Contact (MESITA-2618/2619/2623; no
//      pinned bar).
//   2. The sticky strip, Overview · Reviews · Products (Soon, with Rewards)
//      · Boost, for every place (MESITA-2332, MESITA-2861). While a Google-only profile is being
//      created, Overview is one "No overview yet" screen like the other
//      empty tabs (MESITA-2685), and a refused create shows only the refusal
//      band; there is no vote
//      panel (MESITA-2642: visits enrich) — and Reviews holds Google's up-to-5 from
//      the create-time Details call (MESITA-2317). Enriched: Reviews holds
//      Apify's 100.
//   3. The active tab's boxes.

export function PlaceDetailBody({
  place,
  actions,
  creating,
  social,
  boost,
  openTab,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
  /** The Boost tab's body (MESITA-2861), drawn by the host: the consumer
   *  passes its subscribe/cancel pane; without it the tab explains where
   *  Boost is bought. */
  boost?: React.ReactNode;
  /** The host asks for a tab. Each new `key` switches once; the guest's own
   *  taps win after. */
  openTab?: { tab: PlaceTab; key: number } | null;
  /** Set while a Google-only profile is being created (MESITA-2307): a
   *  Creating fact leads the facts row, or a refusal says why. */
  creating?: PlaceCreatingView | null;
  /** Social v1's line (MESITA-2442), in the profile summary. */
  social?: React.ReactNode;
}) {
  const [tab, setTab] = useState<PlaceTab>(openTab?.tab ?? "place");
  // A new request switches the tab during render (React's "adjust state when
  // a prop changes"), never in an effect.
  const [openKey, setOpenKey] = useState(openTab?.key ?? null);
  if (openTab && openTab.key !== openKey) {
    setOpenKey(openTab.key);
    setTab(openTab.tab);
  }
  const create = place.is_enriched ? null : (creating ?? null);
  return (
    // decision: Pato (2026-10-16) — the name header and the section strip
    // are both white (bg-card). The page wash shows in the content below.
    // pb-4 gives the last section breathing room above whatever footer
    // (nav) the parent layout renders below the scroll area.
    <div className="flex flex-col pb-4">
      <ProfileSummary
        place={place}
        actions={actions}
        social={social}
        creating={create != null && create.error == null}
      />
      <div className="flex flex-col gap-3 px-4">
        <PlaceTabBar tab={tab} onChange={setTab} />
          {/* NO EMPTY BOXES WHILE IT IS CREATED (Pato, MESITA-2685: "if a
              place is being created, better at the bottom write, no
              overview yet, following the same style of reviews and products
              and rewards. why showing no data"). The boxes would only show
              what Mesita does not hold yet. */}
          {tab === "place" && create && (
            create.error ? (
              <div className="-mx-4 -mt-3">
                <PlaceCreateFailedPanel error={create.error} onRetry={create.onRetry} />
              </div>
            ) : (
              <PlaceEmptyScreen {...NO_OVERVIEW} />
            )
          )}
          {tab === "place" && !create && (
            <>
              {/* OVERVIEW'S ORDER (Pato, MESITA-2630): photos ·
                  presentation · location · hours · links · tags. The
                  Created/Updated dates are admin's Metadata card, never
                  here (MESITA-2788). Popular times rides
                  with hours (it draws nothing while nothing writes it,
                  MESITA-2420). Location then Hours stacked, never side by
                  side (decision: Pato). */}
              <MediaBox place={place} />
              <AboutBox text={place.long_description} />
              <LocationBox place={place} onOpenLink={actions?.onOpenLink} />
              <HoursBox place={place} />
              <PopularTimesBox place={place} />
              <LinksBox place={place} onOpenLink={actions?.onOpenLink} />
              <TagsBox place={place} />
              <StatsBox place={place} />
            </>
          )}
          {tab === "reviews" && <GoogleReviewsBox place={place} />}
          {tab === "products" && <SoonScreen />}
          {tab === "boost" && (boost ?? <PlaceEmptyScreen {...NO_BOOST} />)}
      </div>
    </div>
  );
}
