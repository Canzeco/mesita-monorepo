"use client";

import { useState } from "react";
import Image from "next/image";
import { Clock, MapPin, Navigation, Pencil, Star, Tags } from "lucide-react";
import { PartnerBadge, RatePill } from "@/components/shared";
import { cn, firstInitial } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";
import { ImageCarousel } from "./ImageCarousel";

// The static visual "face" of a swipe card. Used by:
//   - SwipeDeck back-card peek (frozen frame, single photo)
//   - SwipeDeck front-card render (multi-photo carousel)
//   - PlacePreview on the business Place page (frozen frame, optional carousel)
//
// Swipe gesture state intentionally lives outside this component — this is
// only the visuals, so anything that needs to display a "what consumers see"
// card can drop it in without inheriting drag logic.

export function VenueSwipeCardFace({
  venue,
  carousel = false,
  priority = false,
  className,
}: {
  venue: Venue;
  /** True on the front swipe card so consumers can browse photos. The back peek
   *  and the preview both use the frozen single-photo background. */
  carousel?: boolean;
  priority?: boolean;
  className?: string;
}) {
  // Track the active photo so the info overlay only renders on photo 1 —
  // photos 2..N are pure imagery (the venue's gallery), per spec.
  const [photoIdx, setPhotoIdx] = useState(0);
  const showOverlay = !carousel || photoIdx === 0;

  return (
    <div
      className={cn(
        "border-border bg-card shadow-elev relative overflow-hidden rounded-3xl border",
        className,
      )}
    >
      <div className="absolute inset-0">
        {carousel && venue.photos.length > 0 ? (
          <ImageCarousel
            key={venue.id}
            photos={venue.photos}
            alt={venue.name}
            aspect="h-full"
            priority={priority}
            mutePosition="top-right"
            noNativeScroll
            onIdxChange={setPhotoIdx}
          />
        ) : venue.photos[0] ? (
          <VenueBackground venue={venue} />
        ) : (
          <PhotoPlaceholder name={venue.name} />
        )}
      </div>

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 transition-opacity duration-200 ease-out",
          showOverlay ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        aria-hidden={!showOverlay}
      >
        <CardOverlay venue={venue} />
      </div>
    </div>
  );
}

function VenueBackground({ venue }: { venue: Venue }) {
  return (
    <div className="bg-muted absolute inset-0">
      <Image
        src={venue.photos[0]}
        alt={venue.name}
        fill
        sizes="(max-width: 768px) 100vw, 420px"
        draggable={false}
        className="object-cover select-none [-webkit-user-drag:none]"
      />
    </div>
  );
}

function PhotoPlaceholder({ name }: { name: string }) {
  const initial = firstInitial(name);
  return (
    <div className="bg-pink-gradient absolute inset-0">
      <div className="absolute inset-0 flex items-center justify-center text-white/70">
        <span className="font-display text-7xl font-bold tracking-tight">
          {initial}
        </span>
      </div>
    </div>
  );
}

function CardOverlay({ venue }: { venue: Venue }) {
  // The overlay mirrors the venue-detail overview grid so the swipe
  // card carries the same eight signals + cashback ribbon, just
  // re-flowed into a denser stack that fits inside a Tinder-style
  // card. Each chip is independently optional — if the EF hasn't
  // populated a field yet, the chip simply doesn't render.
  const priceLevelLabel =
    venue.price_level != null ? "$".repeat(venue.price_level) : null;
  const priceRange = venue.price_range ?? null;
  const closesLabel =
    venue.open_now === false && venue.opens_at
      ? `opens ${venue.opens_at}`
      : venue.closes_at
        ? `until ${venue.closes_at}`
        : null;
  const ratingLabel =
    venue.google_rating != null ? venue.google_rating.toFixed(1) : null;
  const ratingSub =
    venue.google_count != null ? `· ${formatCount(venue.google_count)}` : null;
  const distanceLabel =
    venue.distance_km != null ? `${venue.distance_km} km` : null;
  const zoneLabel = venue.zone ?? null;
  const updatedLabel = venue.last_updated_label
    ? `Updated ${venue.last_updated_label}`
    : null;

  const capPrefix = venue.currency === "MXN" ? "MX$" : "$";
  const capLabel =
    venue.reward_cap_mxn != null
      ? `Capped ${capPrefix}${venue.reward_cap_mxn.toLocaleString("en-US")} / visit`
      : null;

  const showCashback =
    venue.listing_type === "partner" &&
    venue.cashback_percent != null &&
    venue.cashback_percent > 0;
  const mechanicWord = venue.fiscal_type === "informal" ? "discount" : "cashback";

  return (
    <div className="flex flex-col gap-2.5 bg-gradient-to-t from-black/90 via-black/65 to-transparent p-5 pt-24 text-white">
      <div className="min-w-0">
        {(venue.vibe || venue.category) && (
          <p className="text-[11px] font-medium tracking-[0.18em] text-white/75 uppercase">
            {[venue.vibe, venue.category]
              .filter(Boolean)
              .join(" · ")
              .toLowerCase()}
          </p>
        )}
        <h2 className="font-display mt-1 text-[28px] leading-[1.1] font-semibold tracking-tight drop-shadow-sm">
          {venue.name}
        </h2>
      </div>

      {/* Primary meta strip — rating, price range, distance. Each chip
          hides when its field is null so we never render dangling
          icons. */}
      {(ratingLabel || priceRange || priceLevelLabel || distanceLabel) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-white/90">
          {ratingLabel && (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3 w-3 fill-current text-amber-400" />
              <span className="font-semibold">{ratingLabel}</span>
              {ratingSub && (
                <span className="text-white/65">{ratingSub} Google</span>
              )}
            </span>
          )}
          {(priceRange || priceLevelLabel) && (
            <span className="inline-flex items-center gap-1">
              <Tags className="h-3 w-3 text-emerald-300" />
              <span className="font-semibold">
                {priceRange ?? priceLevelLabel}
              </span>
              {priceRange && <span className="text-white/65">per person</span>}
            </span>
          )}
          {distanceLabel && (
            <span className="inline-flex items-center gap-1">
              <Navigation className="h-3 w-3 text-sky-300" />
              <span className="font-semibold">{distanceLabel}</span>
            </span>
          )}
        </div>
      )}

      {/* Secondary meta strip — open status, zone, freshness. Same
          hide-when-empty rules. */}
      {(closesLabel || zoneLabel || updatedLabel) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/80">
          {closesLabel && (
            <span className="inline-flex items-center gap-1">
              <Clock
                className={cn(
                  "h-3 w-3",
                  venue.open_now === false
                    ? "text-white/55"
                    : "text-emerald-300",
                )}
              />
              <span>{closesLabel}</span>
            </span>
          )}
          {zoneLabel && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-pink-300" />
              <span className="max-w-[120px] truncate">{zoneLabel}</span>
            </span>
          )}
          {updatedLabel && (
            <span className="inline-flex items-center gap-1">
              <Pencil className="h-3 w-3 text-white/55" />
              <span>{updatedLabel}</span>
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <PartnerBadge listingType={venue.listing_type} size="md" />
        {showCashback && (
          <RatePill
            percent={venue.cashback_percent!}
            mechanic={mechanicWord}
            size="md"
          />
        )}
      </div>

      {showCashback && capLabel && (
        <p className="text-[10.5px] text-white/65">{capLabel}</p>
      )}
    </div>
  );
}

// Compact "1.9K" / "1.2M" style for review counts. Mirrors the
// formatter used inside VenueDetailBody so the swipe card stays in
// sync with the overview's number style.
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toString();
}
