"use client";

import type React from "react";
import { Star } from "lucide-react";

import { EnrichedBadge } from "../EnrichedBadge";
import { ImageCarousel } from "../ImageCarousel";
import { Spinner } from "../Spinner";
import type { PlaceDetail } from "../../place-detail";
import { firstInitial, formatCompactCount, formatRating } from "../../lib/format";
import { formatPlacePriceLevelSymbols } from "../../lib/place-price";

// ── The top of the place scroll (MESITA-2441) ───────────────────────────
//
// decision: Pato (2026-10-19) — OpenTable/Resy shape: a full-bleed photo
// carousel, then the name, then ONE line: family · price · distance ·
// rating. The Instagram-profile summary (thumbnail + Google/IG/FB counts)
// is gone; Instagram and Facebook live in Links.

/** Full-bleed photos, edge to edge. No photos: the initial on the brand
 *  gradient, shorter, so the name still sits under a picture. */
export function PlaceHero({ place }: { place: PlaceDetail }) {
  if (place.photos.length === 0) {
    return (
      <div className="bg-pink-gradient flex aspect-[2/1] w-full items-center justify-center">
        <span className="font-display text-6xl font-bold text-white/80">
          {firstInitial(place.name)}
        </span>
      </div>
    );
  }
  return (
    <ImageCarousel
      photos={place.photos}
      alt={place.name}
      aspect="aspect-[4/3]"
      rounded="rounded-none"
    />
  );
}

/** The price word for the meta line: the place's own numeric range when it
 *  has one ("MX$500–800"), else the $-symbols of its level. */
function priceWord(place: PlaceDetail): string | null {
  const range = place.price_range.trim();
  if (range && /\d/.test(range)) return range;
  return formatPlacePriceLevelSymbols(place.price_level);
}

/** Name, the meta line, and the social slot under them.
 *
 *  THE SOCIAL SLOT (MESITA-2442). `social` renders directly under the meta
 *  line — "Perdón and 3 others saw this". It is empty until Social v1
 *  passes it; absent, nothing is drawn and no gap is left. */
export function PlaceTitle({
  place,
  social,
}: {
  place: PlaceDetail;
  social?: React.ReactNode;
}) {
  const parts: React.ReactNode[] = [];
  // "Family" here is the place's own kind (category). The guest families
  // are a Discovery filter vocabulary owned by the consumer app.
  if (place.category) parts.push(place.category);
  const price = priceWord(place);
  if (price) parts.push(price);
  // No distance, no "- km" (MESITA-2315).
  if (place.distance_km != null && place.distance_km > 0) {
    parts.push(`${place.distance_km} km`);
  }
  const rating = formatRating(place.google.rating);
  if (rating) {
    parts.push(
      <span className="inline-flex items-center gap-1" key="rating">
        <Star className="text-foreground h-3.5 w-3.5 fill-current" aria-hidden />
        <span className="text-foreground font-semibold">{rating}</span>
        {place.google.count != null ? (
          <span>({formatCompactCount(place.google.count)})</span>
        ) : null}
      </span>,
    );
  }

  return (
    <div className="flex flex-col gap-1.5 px-4 pt-4">
      <h1 className="font-display flex min-w-0 items-center gap-2 text-2xl leading-tight font-semibold tracking-tight">
        <span className="min-w-0 break-words">{place.name}</span>
        {place.is_enriched ? <EnrichedBadge className="h-5 w-5" /> : null}
      </h1>
      {parts.length > 0 && (
        <p
          className="text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm tabular-nums"
          data-testid="place-meta"
        >
          {parts.map((part, i) => (
            <span key={i} className="inline-flex items-center gap-1.5">
              {i > 0 ? <span aria-hidden>·</span> : null}
              {part}
            </span>
          ))}
        </p>
      )}
      {place.is_enriching && (
        <span
          className="text-muted-foreground inline-flex items-center gap-1.5 text-xs font-semibold"
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
      {social ? <div data-slot="social">{social}</div> : null}
    </div>
  );
}
