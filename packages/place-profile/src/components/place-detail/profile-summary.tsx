"use client";

import { Clock, MapPin, Navigation, Star } from "lucide-react";

import { Facebook, Instagram } from "../brand-icons";

import type { PlaceActions } from "../../actions";
import { Spinner } from "../Spinner";
import type { PlaceDetail } from "../../place-detail";
import { formatPlacePriceChip } from "../../lib/place-price";
import { getOpeningStateLabel } from "../../lib/place-state";
import {
  cn,
  formatCompactCount,
  formatDistanceKm,
  formatRating,
} from "../../lib/format";

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
}: {
  place: PlaceDetail;
  actions?: PlaceActions;
}) {
  // decision: Pato — name in header; photo · Google · IG · Facebook; then
  // swipe-style tags: category · price · zone · distance · hours (MESITA-561).
  // decision: Pato (live, 2026-08-03) — the stat trio is the three OUTSIDE
  // channels: Google · Instagram · Facebook. They are the reputation numbers
  // a guest already trusts, and each one has a count to stand on.
  const googleRating = formatRating(place.google.rating);
  const googleCount = place.google.count;
  const stats = [
    googleRating != null
      ? {
          key: "google",
          value: googleRating,
          label: googleCount != null ? `${formatCompactCount(googleCount, false)} Google` : "Google",
          icon: (
            <Star
              className="fill-foreground text-muted-foreground h-3 w-3"
              strokeWidth={0}
            />
          ),
        }
      : null,
    place.instagram.followers != null
      ? {
          key: "instagram",
          value: formatCompactCount(place.instagram.followers, false),
          label: "Instagram",
          icon: <Instagram className="text-muted-foreground h-3 w-3" />,
        }
      : null,
    place.facebook.followers != null
      ? {
          key: "facebook",
          value: formatCompactCount(place.facebook.followers, false),
          label: "Facebook",
          icon: <Facebook className="text-muted-foreground h-3 w-3" />,
        }
      : null,
  ].filter((stat) => stat != null);
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
        {stats.length > 0 ? (
          <div
            className={
              "grid min-w-0 flex-1 gap-1 " +
              (stats.length >= 3
                ? "grid-cols-3"
                : stats.length === 2
                ? "grid-cols-2"
                : "grid-cols-1")
            }
          >
            {stats.map((stat) => (
              <ProfileStat
                key={stat.key}
                value={stat.value}
                label={stat.label}
                icon={stat.icon}
              />
            ))}
          </div>
        ) : (
          <div className="min-w-0 flex-1" />
        )}
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

      <ProfileActions className="mt-5" place={place} actions={actions} />
    </section>
  );
}
