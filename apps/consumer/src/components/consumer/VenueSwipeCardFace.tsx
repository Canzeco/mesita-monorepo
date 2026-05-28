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
        {/* Eyebrow is the venue's single Category (one-of, mapped to a
            Google primary type). Vibe is a tag (multi, 14 dimensions)
            and doesn't belong here — joining the two with " · "
            mis-reads as if a venue could have two categories. Vibe
            ships as a real tag chip when the tag-display work lands. */}
        {venue.category && (
          <p className="text-[11px] font-medium tracking-[0.18em] text-white/75 uppercase">
            {venue.category.toLowerCase()}
          </p>
        )}
        <h2 className="font-display mt-1 text-[28px] leading-[1.1] font-semibold tracking-tight drop-shadow-sm">
          {venue.name}
        </h2>
      </div>

      {/* Glassy chip strip — every overview signal renders as a self-
          contained pill on top of the photo gradient. The pill base
          is a frosted bg-white/12 + ring-white/15 so the chips read
          as one consistent surface; only the rating chip keeps a
          colored accent (amber star), everything else uses muted
          white icons so the strip doesn't look like a christmas tree
          of competing colors. Wraps to a second row on narrow cards. */}
      {(ratingLabel ||
        priceRange ||
        priceLevelLabel ||
        distanceLabel ||
        closesLabel ||
        zoneLabel ||
        updatedLabel) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {ratingLabel && (
            <MetaChip>
              <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
              <span className="font-semibold">{ratingLabel}</span>
              {ratingSub && (
                <span className="text-white/65">{ratingSub} Google</span>
              )}
            </MetaChip>
          )}
          {(priceRange || priceLevelLabel) && (
            <MetaChip>
              <Tags className="text-white/70 h-3 w-3 shrink-0" />
              <span className="font-semibold">
                {priceRange ?? priceLevelLabel}
              </span>
              {priceRange && (
                <span className="text-white/60">per person</span>
              )}
            </MetaChip>
          )}
          {distanceLabel && (
            <MetaChip>
              <Navigation className="text-white/70 h-3 w-3 shrink-0" />
              <span className="font-semibold">{distanceLabel}</span>
            </MetaChip>
          )}
          {closesLabel && (
            <MetaChip>
              <Clock
                className={cn(
                  "h-3 w-3 shrink-0",
                  venue.open_now === false ? "text-white/50" : "text-white/70",
                )}
              />
              <span>{closesLabel}</span>
            </MetaChip>
          )}
          {zoneLabel && (
            <MetaChip>
              <MapPin className="text-white/70 h-3 w-3 shrink-0" />
              <span className="max-w-[120px] truncate">{zoneLabel}</span>
            </MetaChip>
          )}
          {updatedLabel && (
            <MetaChip>
              <Pencil className="text-white/55 h-3 w-3 shrink-0" />
              <span className="text-white/75">{updatedLabel}</span>
            </MetaChip>
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

// Glass pill used by every meta cell on the swipe overlay. Uniform
// padding, font size, and ring so the strip reads as one consistent
// row rather than a pile of mismatched chips. Children supply their
// own icon + value.
function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="ring-white/12 inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11.5px] whitespace-nowrap text-white/90 ring-1 backdrop-blur">
      {children}
    </span>
  );
}
