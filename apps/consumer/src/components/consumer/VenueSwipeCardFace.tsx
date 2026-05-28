"use client";

import { useState } from "react";
import Image from "next/image";
import {
  BadgeCheck,
  Clock,
  Globe,
  MapPin,
  Navigation,
  Sparkles,
  Star,
} from "lucide-react";
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
  const partnerLabel = isPartner ? "Verified partner" : "Web listed";
  const priceLevelLabel =
    venue.price_level != null ? "$".repeat(venue.price_level) : null;
  // Rating always renders with exactly one decimal ("4.3", "4.0") so
  // it visually disambiguates from the integer ratings-count next to
  // it ("1.9K"). No word — the star icon does the labelling.
  const ratingLabel =
    venue.google_rating != null ? venue.google_rating.toFixed(1) : null;
  const ratingCountLabel =
    venue.google_count != null ? formatCount(venue.google_count) : null;
  const distanceLabel =
    venue.distance_km != null ? `${venue.distance_km} km` : null;
  const zoneLabel = venue.zone ?? null;

  // Opening status — surfaces one of three things, in priority order:
  //   open_now === true  + closes_at → "Open · until 02:00"
  //   open_now === false + opens_at  → "Closed · opens 18:00"
  //   only closes_at present         → "Until 02:00" (partial info)
  // The two-fact phrasing ("Open · until …") makes the binary state
  // legible at a glance even when the user doesn't process the time
  // string. Day-aware ("opens tomorrow at 18:00") ships once the EF
  // returns a date, not just an HH:MM.
  const statusLabel = (() => {
    if (venue.open_now === true && venue.closes_at) {
      return `Open · until ${venue.closes_at}`;
    }
    if (venue.open_now === false && venue.opens_at) {
      return `Closed · opens ${venue.opens_at}`;
    }
    if (venue.closes_at) return `Until ${venue.closes_at}`;
    return null;
  })();
  const isOpen = venue.open_now === true;

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

      {/* Row 1 — identity/status: who they are, what they are, how
          much, how good. Row 2 — location: where they are. The two
          dimensions get their own line so the strip reads as two
          parallel facts, not a six-chip soup. */}
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
            <span className="font-semibold">{ratingLabel}</span>
            <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
            {ratingCountLabel && (
              <span className="text-white/65">({ratingCountLabel})</span>
            )}
          </MetaChip>
        )}
      </div>

      {(distanceLabel || zoneLabel || statusLabel) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {distanceLabel && (
            <MetaChip>
              <Navigation className="h-3 w-3 shrink-0 text-white/70" />
              <span className="font-semibold">{distanceLabel}</span>
            </MetaChip>
          )}
          {zoneLabel && (
            <MetaChip>
              <MapPin className="h-3 w-3 shrink-0 text-white/70" />
              <span className="max-w-[180px] truncate font-semibold">
                {zoneLabel}
              </span>
            </MetaChip>
          )}
          {statusLabel && (
            <MetaChip>
              <Clock
                className={cn(
                  "h-3 w-3 shrink-0",
                  isOpen ? "text-emerald-300" : "text-white/55",
                )}
              />
              <span className="font-semibold">{statusLabel}</span>
            </MetaChip>
          )}
        </div>
      )}

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

// Compact "1.9K" / "1.2M" style for ratings counts. Mirrors the
// formatter used inside VenueDetailBody so the swipe card stays in
// sync with the detail page.
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
