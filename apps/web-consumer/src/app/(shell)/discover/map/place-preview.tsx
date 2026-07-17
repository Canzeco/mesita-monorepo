"use client";

import Image from "next/image";
import { ChevronRight, X } from "lucide-react";
import { firstInitial } from "@/lib/utils";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import type { Place } from "@/lib/api/places";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { PartnerBadge, RatePill } from "@/components/shared";
import { resolvePromoRateFromPlaceRow } from "@/lib/promo-rates";

export function PlacePreview({
  place,
  onDismiss,
  onOpen,
}: {
  place: Place;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const photo = place.photos[0];
  // Advertised reward for the preview pill — the base first-visit rate a
  // guest sees before the class context resolves. Only Verified Partners
  // run the Mesita discount, so web listings resolve null and show nothing.
  const discountPercent =
    place.listing_type === "partner"
      ? resolvePromoRateFromPlaceRow(
          place as unknown as Record<string, unknown>,
          true,
          false,
        )
      : null;
  // Category is the single classification (one-of, mapped to a Google
  // primary type). Vibe is a tag and belongs in the future tag-chip
  // strip, not stacked next to the category in this subtitle.
  const subtitle =
    resolvePlaceCategoryName({
      categoryLabel: place.category_label,
      category: place.category,
    }) ?? "";
  const meta = [
    formatPlacePriceLevelSymbols(place.price_level),
    place.closes_at ? `until ${place.closes_at}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div className="pointer-events-none absolute inset-x-3 bottom-4 z-20">
      <div className="border-border bg-card shadow-elev pointer-events-auto relative flex items-stretch gap-3 overflow-hidden rounded-2xl border">
        <button
          type="button"
          onClick={onOpen}
          className="flex flex-1 items-center gap-3 p-2 text-left transition active:opacity-80"
        >
          <span className="bg-muted relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
            {photo ? (
              <Image
                src={photo}
                alt={place.name}
                fill
                sizes="64px"
                className="object-cover"
              />
            ) : (
              <span className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-base font-bold text-white">
                {firstInitial(place.name)}
              </span>
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className="font-display truncate text-[15px] leading-tight font-semibold tracking-tight">
                {place.name}
              </span>
              <PartnerBadge listingType={place.listing_type} size="xs" />
            </span>
            {subtitle && (
              <span className="text-muted-foreground mt-0.5 block truncate text-[11px]">
                {subtitle}
              </span>
            )}
            {(meta || (discountPercent != null && discountPercent > 0)) && (
              <span className="mt-0.5 flex items-center gap-2 text-[11px]">
                {meta && <span className="text-muted-foreground">{meta}</span>}
                {discountPercent != null && discountPercent > 0 && (
                  <RatePill percent={discountPercent} size="xs" />
                )}
              </span>
            )}
          </span>
          <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Close preview"
          className="bg-background/80 text-muted-foreground hover:text-foreground absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-full transition"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
