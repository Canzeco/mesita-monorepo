"use client";

import {
  Clock,
  Facebook,
  Globe,
  Instagram,
  MapPin,
  Navigation,
  Star,
} from "lucide-react";

import { PartnerMark } from "@/components/consumer/PartnerMark";
import { PromoChip } from "@/components/consumer/PromoChip";
import { Spinner } from "@/components/shared";
import type { PlaceDetail } from "@/lib/mock/place";
import { formatPlacePriceChip } from "@/lib/place-price";
import { getOpeningStateLabel } from "@/lib/place-state";
import type { PromoChipPlace } from "@/lib/promo-rates";
import {
  cn,
  formatCompactCount,
  formatDistanceKm,
  formatRating,
} from "@/lib/utils";

import { isPartner } from "@/lib/promo-rates";
import { ProfileActions } from "./ProfileActions";
import {
  ProfileMetaChip,
  ProfilePhoto,
  ProfileStat,
} from "./profile-summary-parts";

// ── 1. Profile summary (IG photo+stats + swipe-style tags) ───────────────

export function ProfileSummary({ place }: { place: PlaceDetail }) {
  // decision: Pato — name in header; photo · Google · IG · Facebook; then
  // swipe-style tags: verification · category · price · zone · distance ·
  // hours · reward (MESITA-561).
  // decision: Pato (live, 2026-08-03) — the stat trio is the three OUTSIDE
  // channels: Google · Instagram · Facebook. Mesita's own review aggregate
  // comes out for now; with almost no Mesita reviews in the wild the slot
  // read as an empty "— / 0 Mesita" next to an 11K Google count. The reward
  // is not a reputation number either — it lives solely as the violet
  // PromoChip in the tag row below.
  const googleRating = formatRating(place.google.rating)!;
  const googleCount = formatCompactCount(place.google.count, false);
  const igFollowers = formatCompactCount(place.instagram.followers, false);
  const fbFollowers = formatCompactCount(place.facebook.followers, false);
  const priceLabel =
    formatPlacePriceChip({
      priceRange: place.price_range,
      priceLevel: place.price_level,
      currency: place.currency,
    }) ?? null;
  const stateValue = getOpeningStateLabel(place);
  const isOpen = place.open_now === true;
  const promoPlace = placeDetailAsPromoPlace(place);
  const partner = isPartner(place);

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
                className="fill-foreground text-muted-foreground h-3 w-3"
                strokeWidth={0}
              />
            }
          />
          <ProfileStat
            value={igFollowers}
            label="Instagram"
            icon={<Instagram className="text-muted-foreground h-3 w-3" />}
          />
          <ProfileStat
            value={fbFollowers}
            label="Facebook"
            icon={<Facebook className="text-muted-foreground h-3 w-3" />}
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
        {/* PARTNER LEADS THE ROW (decision: Pato). This chip and the swipe
            card's twin now state the same fact in the same words — they used
            to read "No reward" here and "Not Verified" there off one shared
            `promoting` boolean, so the same place described itself two ways
            depending on which screen you were on. What the guest EARNS is a
            separate chip (PromoChip, below); this one is who the place is. */}
        <ProfileMetaChip>
          {partner ? (
            <>
              {/* Same mark as the swipe chip and the title, from one file. It
                  was lucide `BadgeCheck` with `fill-current text-primary`:
                  fill and stroke the same colour, so the check vanished into
                  the blob (MESITA-2031). */}
              <PartnerMark className="text-partner h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold">Partner</span>
            </>
          ) : (
            <>
              <Globe className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
              <span className="font-semibold">Not Partner</span>
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
        <PromoChip place={promoPlace} size="md" showWhenEmpty tone="light" />
      </div>

      <ProfileActions className="mt-5" place={place} />
    </section>
  );
}

/** Shim PlaceDetail → PromoChipPlace for the header reward chip. */
function placeDetailAsPromoPlace(place: PlaceDetail): PromoChipPlace {
  return {
    id: place.id,
    promoting: place.promoting,
    welcome_free_rate: place.promo_matrix.welcome.free,
    welcome_premium_rate: place.promo_matrix.welcome.premium,
    free_rate: place.promo_matrix.default.free,
    premium_rate: place.promo_matrix.default.premium,
    reward_cap_mxn: place.reward_cap_mxn,
    currency: place.currency,
  };
}
