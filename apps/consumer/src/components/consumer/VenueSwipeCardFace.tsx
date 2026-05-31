"use client";

import Image from "next/image";
import {
  BadgeCheck,
  Clock,
  Globe,
  Instagram,
  MapPin,
  Navigation,
  Star,
} from "lucide-react";
import { cn, firstInitial } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";
import { getOpeningStatusLabel } from "@/lib/venue-status";
import { ImageCarousel } from "./ImageCarousel";
import { PromoChip } from "./PromoChip";

// The static visual "face" of a swipe card. Used by SwipeDeck for both the
// front card (multi-photo carousel) and the back-card peek (frozen frame).
//
// New layout (replaces the old full-bleed vertical image with the venue
// data overlaid on top of it): TWO stacked boxes —
//   1. Place image — its own rounded box, the photo/carousel only.
//   2. Place info  — a separate white box BELOW the image (not overlaid),
//      carrying the name + signal chips + promo ribbon.
// The root is a transparent flex-col so the two boxes read as distinct
// cards. Swipe gesture state intentionally lives outside this component —
// this is only the visuals.

export function VenueSwipeCardFace({
  venue,
  carousel = false,
  priority = false,
  className,
}: {
  venue: Venue;
  /** True on the front swipe card so consumers can browse photos. The back peek
   *  uses the frozen single-photo image. */
  carousel?: boolean;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      {/* Box 1 — the place image. Fills the space above the info card. */}
      <div className="border-border bg-muted shadow-elev relative min-h-0 flex-1 overflow-hidden rounded-3xl border">
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

      {/* Box 2 — the place info, on a white card below the image. */}
      <CardInfo venue={venue} />
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

function CardInfo({ venue }: { venue: Venue }) {
  // Light info box: name on top, a single wrap-strip of signal chips below
  // (category · price · stars · IG · open status · distance · zone · partner
  // type), then the promo ribbon. Mirrors the venue-detail Overview signals
  // so the card and detail page stay in sync. Each chip is independently
  // optional so missing fields disappear cleanly.
  const isPartner = venue.listing_type === "partner";
  const partnerLabel = isPartner ? "Verified partner" : "Web listed";
  const priceLevelLabel =
    venue.price_level != null ? "$".repeat(venue.price_level) : null;
  // Rating always renders with exactly one decimal ("4.3", "4.0") so it
  // visually disambiguates from the integer ratings-count next to it
  // ("1.9K"). No word — the star icon does the labelling.
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
    <div className="border-border bg-card shadow-elev flex flex-col gap-2.5 rounded-3xl border p-4">
      <h2 className="font-display text-foreground text-2xl leading-[1.15] font-semibold tracking-tight">
        {venue.name}
      </h2>

      {/* One inline-wrap strip carrying every overview signal in a single
          visual flow. Chips wrap naturally. Order: category → price → stars →
          IG → open status → distance → neighborhood → partner status →
          promotion. The promo chip keeps the brand pink gradient so the
          commercial signal stays the loudest pip in the strip. */}
      <div className="flex flex-wrap items-center gap-1.5">
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
              <span className="text-muted-foreground">
                ({ratingCountLabel})
              </span>
            )}
          </MetaChip>
        )}
        {igFollowersLabel && (
          <MetaChip>
            <Instagram className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="font-semibold">{igFollowersLabel}</span>
          </MetaChip>
        )}
        {statusLabel && (
          <MetaChip>
            <Clock
              className={cn(
                "h-3 w-3 shrink-0",
                isOpen ? "text-emerald-600" : "text-muted-foreground",
              )}
            />
            <span className="font-semibold">{statusLabel}</span>
          </MetaChip>
        )}
        {distanceLabel && (
          <MetaChip>
            <Navigation className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="font-semibold">{distanceLabel}</span>
          </MetaChip>
        )}
        {zoneLabel && (
          <MetaChip>
            <MapPin className="text-muted-foreground h-3 w-3 shrink-0" />
            <span className="max-w-[180px] truncate font-semibold">
              {zoneLabel}
            </span>
          </MetaChip>
        )}
        <MetaChip>
          {isPartner ? (
            <BadgeCheck className="h-3 w-3 shrink-0 text-sky-500" />
          ) : (
            <Globe className="text-muted-foreground h-3 w-3 shrink-0" />
          )}
          <span className="font-semibold">{partnerLabel}</span>
        </MetaChip>
        <PromoChip venue={venue} size="md" />
      </div>
    </div>
  );
}

// Compact "1.9K" / "1.2M" style for ratings counts. Mirrors the formatter
// used inside VenueDetailBody so the swipe card stays in sync with the
// detail page.
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return n.toString();
}

// Neutral pill used by every meta cell on the info box. Uniform padding,
// font size, and border so the strip reads as one consistent row rather
// than a pile of mismatched chips. Children supply their own icon + value.
function MetaChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="border-border bg-muted text-foreground/80 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] whitespace-nowrap">
      {children}
    </span>
  );
}
