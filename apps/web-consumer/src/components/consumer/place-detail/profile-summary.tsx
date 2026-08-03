"use client";

import {
  BadgeCheck,
  Clock,
  Globe,
  Instagram,
  MapPin,
  Navigation,
  Star,
} from "lucide-react";

import { PromoChip } from "@/components/consumer/PromoChip";
import { Spinner } from "@/components/shared";
import type { Place } from "@/lib/api/places";
import type { PlaceDetail } from "@/lib/mock/place";
import { formatPlacePriceChip } from "@/lib/place-price";
import {
  cn,
  formatCompactCount,
  formatDistanceKm,
  formatRating,
} from "@/lib/utils";

import { ProfileActions } from "./ProfileActions";
import {
  ProfileMetaChip,
  ProfilePhoto,
  ProfileStat,
} from "./profile-summary-parts";

// ── 1. Profile summary (IG photo+stats + swipe-style tags) ───────────────

export function ProfileSummary({ place }: { place: PlaceDetail }) {
  // decision: Pato — name in header; photo · Google · IG · Mesita; then
  // swipe-style tags: verification · category · price · zone · distance ·
  // hours · reward (MESITA-561).
  // decision: Pato — the stat trio is REPUTATION only (Google · Instagram ·
  // Mesita, since Mesita carries its own reviews too). The reward is not a
  // reputation number and read as odd in that slot — it lives solely as the
  // violet PromoChip in the tag row below.
  const googleRating = formatRating(place.google.rating)!;
  const googleCount = formatCompactCount(place.google.count, false);
  const igFollowers = formatCompactCount(place.instagram.followers, false);
  // Mesita's own review aggregate (mesita_stars_overall / mesita_review_count).
  // Zero reviews → an em dash rather than a fake 0.0.
  const mesitaCount = place.mesita_reviews.total;
  const mesitaRating =
    mesitaCount > 0 ? (formatRating(place.mesita_reviews.overall) ?? "—") : "—";
  const priceLabel = formatPlacePriceChip({
    priceRange: place.price_range,
    priceLevel: place.price_level,
    currency: place.currency,
  });
  const statusValue = place.open_now
    ? `Open · until ${place.closes_at}`
    : `Closed · opens ${place.opens_at}`;
  const promoPlace = placeDetailAsPromoPlace(place);
  const isPartner = place.listing_type === "partner";

  return (
    // Full-bleed white band under the top chrome so the summary reads as
    // the page header; pink body starts at the tab strip below.
    <section className="border-border bg-card flex flex-col gap-3 border-b px-4 pt-3 pb-4">
      <div className="flex items-center gap-4">
        <ProfilePhoto place={place} />
        <div className="grid min-w-0 flex-1 grid-cols-3 gap-1">
          <ProfileStat
            value={googleRating}
            label={`${googleCount} Google`}
            icon={
              <Star
                className="h-3 w-3 fill-amber-500 text-amber-500"
                strokeWidth={0}
              />
            }
          />
          <ProfileStat
            value={igFollowers}
            label="Instagram"
            icon={<Instagram className="h-3 w-3 text-pink-500" />}
          />
          <ProfileStat
            value={mesitaRating}
            label={`${formatCompactCount(mesitaCount, false)} Mesita`}
            icon={
              <Star
                className="h-3 w-3 fill-pink-500 text-pink-500"
                strokeWidth={0}
              />
            }
          />
        </div>
      </div>

      {/* decision: Pato — when the Enricher is still building the profile an
          "Enriching" chip leads the row; then verification · category ·
          price · zone · distance · hours · reward (swipe-style tags on
          light surface). MESITA-451: moved here off the header title.
          MESITA-561: reward chip mirrors swipe PromoChip (showWhenEmpty). */}
      <div className="flex flex-wrap items-center gap-1.5">
        {place.is_enriching && (
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 text-[11.5px] font-semibold whitespace-nowrap text-emerald-900"
            aria-live="polite"
          >
            <Spinner
              size="sm"
              label="Enriching"
              className="h-3 w-3 border-emerald-300 border-t-emerald-600"
            />
            Enriching
          </span>
        )}
        <ProfileMetaChip>
          {isPartner ? (
            <>
              <BadgeCheck
                className="h-3.5 w-3.5 shrink-0 fill-sky-500 text-white"
                strokeWidth={2}
              />
              <span className="font-semibold">Verified Partner</span>
            </>
          ) : (
            <>
              <Globe className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold">Not Verified</span>
            </>
          )}
        </ProfileMetaChip>
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
        <ProfileMetaChip>
          <Clock
            className={cn(
              "h-3 w-3 shrink-0",
              place.open_now ? "text-emerald-600" : "text-muted-foreground",
            )}
          />
          <span
            className={cn(
              "font-semibold",
              place.open_now ? "text-emerald-700" : undefined,
            )}
          >
            {statusValue}
          </span>
        </ProfileMetaChip>
        <PromoChip place={promoPlace} size="md" showWhenEmpty tone="light" />
      </div>

      <ProfileActions className="mt-5" place={place} />
    </section>
  );
}

/** Shim PlaceDetail → Place shape PromoChip / resolvePromoRateFromPlaceRow expect. */
function placeDetailAsPromoPlace(place: PlaceDetail): Place {
  return {
    id: place.id,
    name: place.name,
    listing_type: place.listing_type,
    is_first_visit: place.promo_matrix.is_first_visit,
    welcome_free_rate: place.promo_matrix.welcome.free,
    welcome_premium_rate: place.promo_matrix.welcome.premium,
    free_rate: place.promo_matrix.default.free,
    premium_rate: place.promo_matrix.default.premium,
    reward_cap_mxn: place.reward_cap_mxn,
    currency: place.currency,
  } as unknown as Place;
}
