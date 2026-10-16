"use client";

import { Clock, MapPin, Navigation } from "lucide-react";

import { Spinner } from "../Spinner";
import type { PlaceDetail } from "../../place-detail";
import { formatPlacePriceChip } from "../../lib/place-price";
import { getOpeningStateLabel } from "../../lib/place-state";
import {
  cn,
  formatDistanceKm,
} from "../../lib/format";

import { profileChannelStats } from "./channel-stats";
import { channelStatIcon } from "./channel-stat-icons";
import {
  ProfileMetaChip,
  ProfilePhoto,
  ProfileStat,
} from "./profile-summary-parts";

// ── 1. Profile summary (IG photo+stats + swipe-style tags) ───────────────

export function ProfileSummary({ place }: { place: PlaceDetail }) {
  // decision: Pato — name in header; photo · Google · IG · Facebook; then
  // swipe-style tags: category · price · zone · distance · hours (MESITA-561).
  // The three action buttons are pinned below the scroll: Reserve · Pay · Save.
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
    // the page header; pink body starts at the tab strip below.
    <section className="border-border bg-card flex flex-col gap-3 border-b px-4 pt-3 pb-4">
      <div className="flex items-center gap-4">
        <ProfilePhoto place={place} />
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
          {stats.map((stat) => (
            <ProfileStat
              key={stat.key}
              value={stat.value}
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
            className="border-border bg-muted text-foreground inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold whitespace-nowrap"
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
        <ProfileMetaChip>
          <MapPin className="text-muted-foreground h-3 w-3 shrink-0" />
          <span className="max-w-[160px] truncate font-semibold">
            {place.zone}
          </span>
        </ProfileMetaChip>
        <ProfileMetaChip>
          <Navigation className="text-muted-foreground h-3 w-3 shrink-0" />
          <span className="font-semibold">
            {formatDistanceKm(place.distance_km)}
          </span>
        </ProfileMetaChip>
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

    </section>
  );
}
