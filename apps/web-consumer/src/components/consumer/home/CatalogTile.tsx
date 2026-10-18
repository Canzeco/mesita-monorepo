"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Star } from "lucide-react";
import { EnrichedBadge } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { isEnrichedPlace } from "@/lib/place-enriched";
import { placeHref } from "@/lib/place-route";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import {
  cardPhoto,
  isGoogleOnlyPlace,
  placePlaceholder,
} from "@/lib/place-placeholder";
import { cn, formatRating } from "@/lib/utils";

/**
 * A Google-only card has no Mesita page yet. Its tap is the explicit open
 * (MESITA-2298): the parent's `onOpenGoogle` runs get-or-create on the
 * Google Place ID and routes to the profile. Never a link, never a prefetch,
 * never Google Maps.
 */
function TileLink({
  href,
  google,
  onOpen,
  label,
  className,
  children,
}: {
  href: string;
  /** A Google-only card is a button, never a link to a page it has no row for. */
  google: boolean;
  /** The parent's explicit open for that button. */
  onOpen?: () => void;
  label: string;
  className: string;
  children: ReactNode;
}) {
  if (google) {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${label}`}
        className={`${className} w-full text-left`}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

function readableKind(place: Place): string | null {
  const raw = place.category_label ?? place.category;
  if (!raw || raw.trim().toLowerCase() === "undefined") return null;
  return raw;
}

/**
 * One place in a family rail: one square card (Pato, MESITA-2344), the
 * photo the top two thirds and the white band the bottom third
 * (MESITA-2348) — the name with
 * the save heart beside it, then price, the Google category, and the
 * Google stars. No zone. The row is about 2.5 of
 * these wide. An enriched place wears the Enriched mark after its name
 * (MESITA-2296). Favs does not use this tile. A Google-only card opens its
 * profile through `onOpenGoogle` and has no save heart: only a Mesita place
 * can be saved.
 */
export function CatalogTile({
  place,
  saved,
  onToggle,
  onOpenGoogle,
  className,
}: {
  place: Place;
  saved: boolean;
  onToggle: () => void;
  /** The explicit open for a Google-only card (get-or-create, then route). */
  onOpenGoogle?: () => void;
  className?: string;
}) {
  const photo = cardPhoto(place);
  const placeholder = placePlaceholder(place);
  const google = isGoogleOnlyPlace(place);
  const href = placeHref(place.slug || place.id);
  const priceLabel = formatPlacePriceLevelSymbols(place.price_level);
  const kind = readableKind(place);
  const ratingLabel = formatRating(place.google_rating);
  const facts = [priceLabel, kind, ratingLabel].filter(Boolean);

  return (
    <li className={cn("min-w-0", className)}>
      <div className="bg-card border-border flex aspect-square flex-col overflow-hidden rounded-2xl border">
        <TileLink
          href={href}
          google={google}
          onOpen={onOpenGoogle}
          label={place.name}
          className="focus-visible:ring-primary block h-2/3 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <div className="bg-muted relative h-full w-full overflow-hidden">
            {photo ? (
              <Image
                src={photo}
                alt=""
                fill
                sizes="(max-width: 448px) 40vw, 180px"
                className="object-cover"
              />
            ) : (
              <div
                className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-white/90"
                data-placeholder={placeholder.kind}
              >
                <span
                  className="font-display text-3xl font-bold tracking-tight"
                  aria-hidden
                >
                  {placeholder.text}
                </span>
              </div>
            )}
          </div>
        </TileLink>
        <div className="flex h-1/3 shrink-0 items-start pr-0.5 pl-2.5">
          <TileLink
            href={href}
            google={google}
            onOpen={onOpenGoogle}
            label={place.name}
            className="focus-visible:ring-primary min-w-0 flex-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            <p className="font-display text-foreground flex min-w-0 items-center gap-1 text-sm leading-tight font-semibold tracking-tight">
              <span className="truncate">{place.name}</span>
              {isEnrichedPlace(place) ? (
                <EnrichedBadge className="h-3.5 w-3.5" />
              ) : null}
            </p>
            {facts.length > 0 ? (
              <p className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-tight">
                {priceLabel ? (
                  <span className="shrink-0">{priceLabel}</span>
                ) : null}
                {kind ? (
                  <span className="truncate">
                    {priceLabel ? "· " : ""}
                    {kind}
                  </span>
                ) : null}
                {ratingLabel ? (
                  <span className="inline-flex shrink-0 items-center gap-0.5">
                    {priceLabel || kind ? <span aria-hidden>·</span> : null}
                    <Star className="fill-foreground text-foreground h-3 w-3" />
                    {ratingLabel}
                  </span>
                ) : null}
              </p>
            ) : null}
          </TileLink>
          {google ? null : (
            <button
              type="button"
              onClick={onToggle}
              aria-label={
                saved ? `Remove ${place.name} from saved` : `Save ${place.name}`
              }
              className="flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <Heart
                className={cn(
                  "h-4 w-4",
                  saved
                    ? "fill-foreground text-foreground"
                    : "text-muted-foreground",
                )}
              />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
