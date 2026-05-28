"use client";

import { useState } from "react";
import Image from "next/image";
import { BadgeCheck, Globe, Navigation, Sparkles, Star } from "lucide-react";
import { cn, firstInitial } from "@/lib/utils";
import { CURRENT_USER } from "@/lib/consumer-data";
import type { Venue } from "@/lib/api/venues";
import { ImageCarousel } from "./ImageCarousel";

const TIER_PROPER: Record<string, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  diamond: "Diamond",
};

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
  // Tight overlay: name on top, a single info strip below (partner type
  // · category · price · stars · distance), then a full-width cashback
  // ribbon. The previous version stacked an eyebrow + two strips +
  // partner/rate chips + a cap line — way too busy. Each chip is still
  // independently optional so missing fields disappear cleanly.
  const isPartner = venue.listing_type === "partner";
  const partnerLabel = isPartner ? "Verified" : "Listed";
  const priceLevelLabel =
    venue.price_level != null ? "$".repeat(venue.price_level) : null;
  const ratingLabel =
    venue.google_rating != null ? venue.google_rating.toFixed(1) : null;
  const distanceLabel =
    venue.distance_km != null ? `${venue.distance_km} km` : null;

  const showCashback =
    isPartner &&
    venue.cashback_percent != null &&
    venue.cashback_percent > 0;
  const mechanicWord =
    venue.fiscal_type === "informal" ? "discount" : "cashback";
  const tierLabel = TIER_PROPER[CURRENT_USER.tier] ?? "Mesita";
  const capPrefix = venue.currency === "MXN" ? "MX$" : "$";
  const capLabel =
    venue.reward_cap_mxn != null
      ? `Capped ${capPrefix}${venue.reward_cap_mxn.toLocaleString("en-US")} / visit`
      : null;

  return (
    <div className="flex flex-col gap-2.5 bg-gradient-to-t from-black/90 via-black/65 to-transparent p-5 pt-24 text-white">
      <h2 className="font-display text-[28px] leading-[1.1] font-semibold tracking-tight drop-shadow-sm">
        {venue.name}
      </h2>

      <div className="flex flex-wrap items-center gap-1.5">
        <MetaChip>
          {isPartner ? (
            <BadgeCheck className="h-3 w-3 shrink-0 text-sky-300" />
          ) : (
            <Globe className="h-3 w-3 shrink-0 text-white/70" />
          )}
          <span className="font-semibold">{partnerLabel}</span>
        </MetaChip>
        {venue.category && (
          <MetaChip>
            <span className="font-semibold capitalize">
              {venue.category.toLowerCase()}
            </span>
          </MetaChip>
        )}
        {priceLevelLabel && (
          <MetaChip>
            <span className="font-semibold">{priceLevelLabel}</span>
          </MetaChip>
        )}
        {ratingLabel && (
          <MetaChip>
            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
            <span className="font-semibold">{ratingLabel}</span>
          </MetaChip>
        )}
        {distanceLabel && (
          <MetaChip>
            <Navigation className="h-3 w-3 shrink-0 text-white/70" />
            <span className="font-semibold">{distanceLabel}</span>
          </MetaChip>
        )}
      </div>

      {showCashback && (
        <div className="bg-pink-gradient shadow-glow mt-0.5 flex items-center gap-2.5 rounded-xl px-3 py-2.5">
          <Sparkles className="h-4 w-4 shrink-0" strokeWidth={2.5} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-[14px] font-bold">
              {venue.cashback_percent}% {mechanicWord}
            </p>
            <p className="text-[10.5px] text-white/85">
              at Mesita {tierLabel}
              {capLabel ? ` · ${capLabel}` : ""}
            </p>
          </div>
        </div>
      )}
    </div>
  );
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
