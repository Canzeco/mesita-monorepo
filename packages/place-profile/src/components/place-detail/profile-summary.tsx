"use client";

import type React from "react";
import { Banknote, Clock, MapPin, Navigation, Tag } from "lucide-react";

import type { PlaceActions } from "../../actions";
import { Spinner } from "../Spinner";
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
} from "./profile-summary-parts";

// ── 1. Profile summary (IG photo+stats + swipe-style tags) ───────────────

export function ProfileSummary({
  place,
  actions,
  social,
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
  /** Social v1's line (MESITA-2442): who saved or saw, where
   *  Instagram shows "Followed by". */
  social?: React.ReactNode;
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
    <section className="border-border bg-card flex flex-col gap-4 border-b p-4">
      <div className="flex items-center gap-3" data-profile-section="identity">
        <ProfilePhoto place={place} />
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-2">
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
          Enriching fact leads the row (MESITA-451). */}
      <div className="flex flex-col gap-3" data-profile-section="facts">
      <ul
        className="flex flex-wrap items-center gap-2"
        aria-label="About this place"
        data-profile-facts
      >
        {place.is_enriching && (
          <ProfileFact aria-live="polite">
            <Spinner
              size="sm"
              label="Enriching"
              className="border-border h-3.5 w-3.5 border-t-emerald-600"
            />
            Enriching
          </ProfileFact>
        )}
        {place.category && (
          <ProfileFact icon={Tag}>{place.category}</ProfileFact>
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
