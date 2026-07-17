"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import {
  ChevronRight,
  Compass,
  Crosshair,
  Globe,
  MapPin as MapPinIcon,
  Sparkles,
  X,
} from "lucide-react";
import { firstInitial } from "@/lib/utils";
import { SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import type { Place } from "@/lib/api/places";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { PartnerBadge, RatePill, Skeleton, Spinner } from "@/components/shared";
import { resolvePromoRateFromPlaceRow } from "@/lib/promo-rates";
import {
  MAP_PARTNER_PIN_COLOR,
  MAP_WEB_PIN_COLOR,
} from "@/lib/map-defaults";

export function MapLoadingVeil({ loadFailed }: { loadFailed: boolean }) {
  if (loadFailed) {
    return null;
  }
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <Skeleton className="absolute inset-0 rounded-none" />
      <div className="absolute inset-0 flex items-center justify-center">
        <Spinner
          label="Loading map"
          className="border-border border-t-primary"
        />
      </div>
    </div>
  );
}

export function MapChromeHeader({
  placesCount,
  totalPlaces,
}: {
  placesCount: number;
  totalPlaces: number;
}) {
  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-2 p-3">
      <div className="bg-card/95 text-foreground pointer-events-auto rounded-full px-3 py-1.5 text-[11px] font-semibold backdrop-blur">
        <Compass className="mr-1 inline-block h-3 w-3 -translate-y-0.5" />
        {placesCount} of {totalPlaces} near here
      </div>
      <div className="bg-card/95 text-foreground pointer-events-auto flex flex-col gap-1 rounded-2xl p-2 text-[10px] font-semibold backdrop-blur">
        <LegendDot
          color={MAP_PARTNER_PIN_COLOR}
          icon={<Sparkles className="h-2.5 w-2.5" />}
        >
          Partner
        </LegendDot>
        <LegendDot
          color={MAP_WEB_PIN_COLOR}
          icon={<Globe className="h-2.5 w-2.5" />}
        >
          Web listing
        </LegendDot>
      </div>
    </header>
  );
}

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

export function RecentreButton({
  onRecentre,
  raised = false,
}: {
  onRecentre: () => void;
  raised?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onRecentre}
      aria-label="Centre map on me"
      className={`bg-card text-foreground shadow-elev hover:bg-muted absolute right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full transition ${
        raised ? "bottom-28" : "bottom-4"
      }`}
    >
      <Crosshair className="h-4 w-4" />
    </button>
  );
}

export function LegendDot({
  color,
  icon,
  children,
}: {
  color: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className="flex h-3 w-3 items-center justify-center rounded-full text-white"
        style={{ background: color }}
      >
        {icon}
      </span>
      {children}
    </span>
  );
}

export function SetupCard({ title, body }: { title: string; body: ReactNode }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-2xl">
        <MapPinIcon className="text-muted-foreground h-5 w-5" />
      </div>
      <h2 className={SHEET_TITLE_CLASS}>{title}</h2>
      <p className="text-muted-foreground max-w-sm text-sm">{body}</p>
    </div>
  );
}
