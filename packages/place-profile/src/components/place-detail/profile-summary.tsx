"use client";

import type React from "react";
import { Banknote, Clock, MapPin, Navigation, Tag, Zap } from "lucide-react";

import type { PlaceActions } from "../../actions";
import type { PlaceDetail } from "../../place-detail";
import { formatPlacePriceChip } from "../../lib/place-price";
import { getOpeningStateLabel } from "../../lib/place-state";
import { cn, formatDistanceKm } from "../../lib/format";

import { profileChannelStats } from "./channel-stats";
import { channelStatIcon } from "./channel-stat-icons";
import { ProfileActions } from "./ProfileActions";
import {
  ProfileFact,
  ProfilePhoto,
  ProfileStat,
  RunningFact,
} from "./profile-summary-parts";

// ── 1. Profile summary (IG photo+stats + swipe-style tags) ───────────────

// THE BAND'S LAYOUT IS WRITTEN ONCE (Pato, MESITA-2701: "the placeholders
// must be similar to the page you are loading, like the sizes"): the band,
// the photo-and-counts row, the counts' grid and the facts row are read here
// and by ProfileSummarySkeleton.

/** The white band: p-4, 16px between its groups. */
export const PROFILE_SUMMARY_BAND_CLASS =
  "border-border bg-card flex flex-col gap-4 border-b p-4";
/** The photo, then the three counts, 12px apart. */
export const PROFILE_IDENTITY_ROW_CLASS = "flex items-center gap-3";
/** The three counts: equal columns, 8px apart. */
export const PROFILE_STATS_GRID_CLASS = "grid min-w-0 flex-1 grid-cols-3 gap-2";
/** The facts: outlined boxes, 8px apart, wrapping. */
export const PROFILE_FACTS_ROW_CLASS = "flex flex-wrap items-center gap-2";

export function ProfileSummary({
  place,
  actions,
  social,
  creating = false,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
  /** Social v1's line (MESITA-2442): who saved or saw, where
   *  Instagram shows "Followed by". */
  social?: React.ReactNode;
  /** Mesita is creating this Google-only profile right now (MESITA-2307). */
  creating?: boolean;
}) {
  // decision: Pato — name in header; photo · Google · IG · Facebook; then
  // the facts row: category · price · hours · zone · distance (MESITA-2629).
  // decision: Pato (2026-10-16) — normal buttons in this header, in order:
  // one action row: the heart, Reserve · Directions, then Contact
  // (MESITA-2321, reshaped MESITA-2618/2619/2623; no pinned bar).
  // Save is not an action button and is not Soon.
  // decision: Pato (2026-10-18, MESITA-2334) — the trio shows on every tab,
  // Reviews included; the header never changes between tabs.
  // decision: Pato (live, 2026-08-03) — the stat trio is the three OUTSIDE
  // channels: Google · Instagram · Facebook, laid out like an Instagram
  // profile's posts · followers · following.
  // decision: Pato (live, 2026-10-16) — a zero stays visible. No number
  // shows "-" (MESITA-2647: "don't say not connected and no count … just
  // say -"). The icon stays either way; the cell is never blank.
  const stats = profileChannelStats(place);
  const priceLabel =
    formatPlacePriceChip({
      priceRange: place.price_range,
      priceLevel: place.price_level,
      currency: place.currency,
    }) ?? null;
  const stateValue = getOpeningStateLabel(place);
  const isOpen = place.open_now === true;

  return (
    // Full-bleed white band under the top chrome so the summary reads as
    // the page header. The section strip below is the same white surface.
    // ONE WHITE BAND, NO DIVIDING LINES (Pato, MESITA-2633: "remove the
    // lines dividing the profile. it looks like shit"; MESITA-2632's
    // hairline sections lived one night). Three groups: photo + the three
    // counts, the facts (outlined boxes) and the social line, then the two
    // action rows; 16px around the band and between groups, 8px between
    // items. Only buttons wear a fill (MESITA-2623).
    <section className={PROFILE_SUMMARY_BAND_CLASS}>
      <div className={PROFILE_IDENTITY_ROW_CLASS} data-profile-section="identity">
        <ProfilePhoto place={place} />
        <div className={PROFILE_STATS_GRID_CLASS}>
          {stats.map((stat) => (
            <ProfileStat
              key={stat.key}
              value={stat.value}
              detail={stat.detail}
              label={stat.label}
              icon={channelStatIcon(stat)}
              mention={stat.mention}
              spokenValue={stat.spoken}
              name={stat.name}
            />
          ))}
        </div>
      </div>

      {/* THE FACTS ROW (Pato, MESITA-2629: "change the background of the
          tags/general data of the place because it looks like a button. the
          stuff at the top must include google category, price, hour, zone,
          distance"). Plain text, each fact behind a small muted icon, no
          fill and no pill: on this screen only buttons wear a fill. In this
          order: Google's category (the place's Google primary type) · price ·
          hours · zone · distance; a missing fact draws nothing, never a
          "- km" (MESITA-2315). While the Enricher builds the profile an
          Enriching fact leads the row (MESITA-451). CREATING LEADS IT THE
          SAME WAY (Pato, MESITA-2679: "use same aesthetic as enriching for
          the tag, it must kinda look as a first tag before the primary
          category") while Mesita creates a Google-only profile; it replaced
          the Creating band at the top of Overview ("the creating there
          looks like shit"). Creating is solid blue (MESITA-2682: "it must
          be noticable"), Enriching solid green (MESITA-2812). */}
      <div className="flex flex-col gap-3" data-profile-section="facts">
      <ul
        className={PROFILE_FACTS_ROW_CLASS}
        aria-label="About this place"
        data-profile-facts
      >
        {creating ? (
          <RunningFact label="Creating" tone="blue" />
        ) : place.is_enriching ? (
          <RunningFact label="Enriching" tone="green" />
        ) : null}
        {/* SPONSORED (MESITA-2789): a paid Boost is disclosed, plain and
            grey like every fact. Never red (red is Selected, Mesita's own
            pick) and never "Verified": paying buys visibility only. */}
        {(place.boost_tier ?? 0) > 0 && <ProfileFact icon={Zap}>Boosted</ProfileFact>}
        {place.category && (
          // The category's own emoji, Tag only when it has none (MESITA-2813).
          <ProfileFact icon={Tag} emoji={place.category_emoji}>
            {place.category}
          </ProfileFact>
        )}
        {priceLabel && <ProfileFact icon={Banknote}>{priceLabel}</ProfileFact>}
        {stateValue && (
          <ProfileFact icon={Clock} strong={isOpen}>
            {stateValue}
          </ProfileFact>
        )}
        {place.zone && (
          <ProfileFact icon={MapPin}>
            <span className="max-w-[180px] truncate">{place.zone}</span>
          </ProfileFact>
        )}
        {place.distance_km != null && place.distance_km > 0 && (
          <ProfileFact icon={Navigation}>
            {formatDistanceKm(place.distance_km)}
          </ProfileFact>
        )}
      </ul>

      {social ? <div data-slot="social">{social}</div> : null}
      </div>

      <div data-profile-section="actions">
        <ProfileActions place={place} actions={actions} />
      </div>
    </section>
  );
}
