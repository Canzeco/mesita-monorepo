"use client";

import type React from "react";
import { Clock, MapPin, Navigation } from "lucide-react";

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
  ProfileMetaChip,
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
  // swipe-style tags: category · price · zone · distance · hours (MESITA-561).
  // decision: Pato (2026-10-16) — normal buttons in this header, in order:
  // one action row: the heart, Reserve · Directions, then Contact
  // (MESITA-2321, reshaped MESITA-2618/2619/2623; no pinned bar).
  // Save is not an action button and is not Soon.
  // decision: Pato (2026-10-18, MESITA-2334) — the trio shows on every tab,
  // Reviews included; the header never changes between tabs.
  // decision: Pato (live, 2026-08-03) — the stat trio is the three OUTSIDE
  // channels: Google · Instagram · Facebook, laid out like an Instagram
  // profile's posts · followers · following.
  // decision: Pato (live, 2026-10-16) — a zero stays visible. No link says
  // "Not connected". A link with no number says "No count". The icon stays
  // either way; the cell is never blank.
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
    <section className="border-border bg-card flex flex-col gap-3 border-b px-4 pt-3 pb-4">
      <div className="flex items-center gap-4">
        <ProfilePhoto place={place} />
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
          {stats.map((stat) => (
            <ProfileStat
              key={stat.key}
              value={stat.value}
              detail={stat.detail}
              label={stat.label}
              icon={channelStatIcon(stat)}
              mention={stat.mention}
              name={stat.name}
            />
          ))}
        </div>
      </div>

      {/* decision: Pato — when the Enricher is still building the profile an
          "Enriching" chip leads the row; then category · price · zone ·
          distance · hours (swipe-style tags on light surface). MESITA-451:
          moved here off the header title. */}
      <div className="flex flex-wrap items-center gap-1.5">
        {place.is_enriching && (
          <span
            className="bg-muted text-foreground inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
            aria-live="polite"
          >
            <Spinner
              size="sm"
              label="Enriching"
              className="border-border h-3 w-3 border-t-emerald-600"
            />
            Enriching
          </span>
        )}
        {place.category && (
          <ProfileMetaChip>
            <span className="font-semibold">{place.category}</span>
          </ProfileMetaChip>
        )}
        {priceLabel && (
          <ProfileMetaChip>
            <span className="font-semibold">{priceLabel}</span>
          </ProfileMetaChip>
        )}
        {/* No zone, no chip; no distance, no "- km" chip (MESITA-2315). */}
        {place.zone && (
          <ProfileMetaChip>
            <MapPin className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="max-w-[160px] truncate font-semibold">
              {place.zone}
            </span>
          </ProfileMetaChip>
        )}
        {place.distance_km != null && place.distance_km > 0 && (
          <ProfileMetaChip>
            <Navigation className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="font-semibold">
              {formatDistanceKm(place.distance_km)}
            </span>
          </ProfileMetaChip>
        )}
        {stateValue && (
          <ProfileMetaChip>
            <Clock
              className={cn(
                "h-3 w-3 shrink-0",
                isOpen ? "text-foreground" : "text-muted-foreground",
              )}
            />
            <span
              className={cn(
                "font-semibold",
                isOpen ? "text-foreground" : undefined,
              )}
            >
              {stateValue}
            </span>
          </ProfileMetaChip>
        )}
      </div>

      {social ? <div data-slot="social">{social}</div> : null}

      <ProfileActions className="mt-3" place={place} actions={actions} />
    </section>
  );
}
