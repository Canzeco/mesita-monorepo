"use client";

import { useState } from "react";
import Image from "next/image";
import { Star } from "lucide-react";
import { PartnerBadge, RatePill } from "@/components/shared";
import { cn } from "@/lib/utils";
import type { Venue } from "@/lib/api/venues";
import { ImageCarousel } from "./ImageCarousel";

// The static visual "face" of a swipe card. Used by:
//   - SwipeDeck back-card peek (frozen frame, single photo)
//   - SwipeDeck front-card render (multi-photo carousel)
//   - PlacePreview on the manager Place page (frozen frame, optional carousel)
//
// Swipe gesture state intentionally lives outside this component — this is
// only the visuals, so anything that needs to display a "what guests see"
// card can drop it in without inheriting drag logic.

// 30 days from now in ms — the "New" badge only fires for venues onboarded
// inside that window so it stays meaningful instead of being on every card.
// Evaluated at module load so the React 19 purity-in-render lint doesn't
// flag Date.now() inside the component body.
const NEW_BADGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const NEW_BADGE_THRESHOLD = Date.now() - NEW_BADGE_WINDOW_MS;

export function VenueSwipeCardFace({
  venue,
  carousel = false,
  priority = false,
  className,
}: {
  venue: Venue;
  /** True on the front swipe card so guests can browse photos. The back peek
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

export function PhotoPlaceholder({ name }: { name: string }) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "·";
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
  const meta = [
    venue.price_level != null ? "$".repeat(venue.price_level) : null,
    venue.closes_at ? `until ${venue.closes_at}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const isNew =
    !!venue.created_at && Date.parse(venue.created_at) > NEW_BADGE_THRESHOLD;

  return (
    <div className="flex flex-col gap-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-5 pt-24 text-white">
      <div className="min-w-0">
        {(venue.vibe || venue.category) && (
          <p className="text-[11px] font-medium tracking-[0.18em] text-white/75 uppercase">
            {[venue.vibe, venue.category]
              .filter(Boolean)
              .join(" · ")
              .toLowerCase()}
          </p>
        )}
        <h2 className="font-display mt-1 text-3xl leading-tight font-semibold tracking-tight drop-shadow-sm">
          {venue.name}
        </h2>
        {meta && <p className="mt-1 text-[12px] text-white/85">{meta}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {isNew && (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1.5 text-[10px] font-bold tracking-wider text-zinc-900 uppercase shadow-sm">
            <Star className="h-3 w-3" />
            New
          </span>
        )}
        <PartnerBadge listingType={venue.listing_type} size="md" />
        {venue.listing_type === "partner" &&
          venue.cashback_percent != null &&
          venue.cashback_percent > 0 && (
            <RatePill
              percent={venue.cashback_percent}
              mechanic={
                venue.fiscal_type === "informal" ? "discount" : "cashback"
              }
              size="md"
            />
          )}
      </div>
    </div>
  );
}
