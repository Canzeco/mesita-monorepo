"use client";

import Image from "next/image";
import {
  BadgeCheck,
  Clock,
  Globe,
  Instagram,
  MapPin,
  Navigation,
  Pencil,
  Star,
} from "lucide-react";
import { cn, firstInitial } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";
import { getOpeningStatusLabel } from "@/lib/venue-status";
import { ImageCarousel } from "./ImageCarousel";
import { PromoChip } from "./PromoChip";

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
          />
        ) : venue.photos[0] ? (
          <VenueBackground venue={venue} />
        ) : (
          <PhotoPlaceholder name={venue.name} />
        )}
      </div>

      {/* Venue data overlay — stays on top of EVERY photo, not just the
          first, so the name + signals are always visible while browsing
          the gallery. */}
      <div className="absolute inset-x-0 bottom-0 z-20">
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
  // · freshness · category · price · stars · distance · zone · status),
  // then a full-width cashback ribbon. This strip mirrors every cell of
  // the venue-detail Overview grid so the card carries the same signals.
  // Each chip is independently optional so missing fields disappear
  // cleanly.
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
  // Instagram followers always carry one decimal (e.g. "23.0K", "1.9K") so
  // the social-proof number reads precise, unlike the rounded rating count.
  const igFollowersLabel = (() => {
    const n = venue.instagram_followers_count;
    if (n == null) return null;
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  })();

  const statusLabel = getOpeningStatusLabel(venue);
  const isOpen = venue.open_now === true;

  return (
    <div className="flex flex-col gap-2.5 bg-gradient-to-t from-black/90 via-black/65 to-transparent p-5 pt-24 text-white">
      <h2 className="font-display text-[28px] leading-[1.1] font-semibold tracking-tight drop-shadow-sm">
        {venue.name}
      </h2>

      {/* One inline-wrap strip carrying every overview signal in a
          single visual flow. Chips wrap naturally — the strip can be
          one, two, three or four rows tall depending on how much
          actually applies to the venue. Order matches the spec:
          verification → freshness → category → price → stars → distance →
          neighborhood → open status → promotion. The promotion chip
          uses the brand pink gradient so the commercial signal stays
          the loudest pip in the strip. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <MetaChip>
          {isPartner ? (
            <BadgeCheck className="h-3 w-3 shrink-0 text-sky-300" />
          ) : (
            <Globe className="h-3 w-3 shrink-0 text-white/70" />
          )}
          <span className="font-semibold">{partnerLabel}</span>
        </MetaChip>
        {venue.last_updated_label && (
          <MetaChip>
            <Pencil className="h-3 w-3 shrink-0 text-white/70" />
            <span className="font-semibold">
              Updated {venue.last_updated_label}
            </span>
          </MetaChip>
        )}
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
            {ratingCountLabel && <span>({ratingCountLabel})</span>}
          </MetaChip>
        )}
        {igFollowersLabel && (
          <MetaChip>
            <Instagram className="h-3 w-3 shrink-0 text-white/80" />
            <span className="font-semibold">{igFollowersLabel}</span>
          </MetaChip>
        )}
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
        <PromoChip venue={venue} size="md" />
      </div>
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
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-2.5 py-1 text-[11.5px] whitespace-nowrap text-white/90 ring-1 ring-white/12 backdrop-blur">
      {children}
    </span>
  );
}
