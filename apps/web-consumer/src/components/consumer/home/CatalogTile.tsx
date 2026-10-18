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
 * photo the top half and the info band the bottom half (MESITA-2360) — the
 * photo's reflection under a 50% ink layer (MESITA-2363) carrying the name with
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
  // The photo, or the Google card's emoji tile. Drawn twice: on top, and
  // flipped under the info as its reflection (Pato, MESITA-2363).
  const media = (mirrored: boolean) =>
    photo ? (
      <Image
        src={photo}
        alt=""
        fill
        sizes="(max-width: 448px) 40vw, 180px"
        className={cn("object-cover", mirrored && "-scale-y-100")}
      />
    ) : (
      <div
        className={cn(
          "bg-pink-gradient absolute inset-0 flex items-center justify-center text-white/90",
          mirrored && "-scale-y-100",
        )}
        data-placeholder={placeholder.kind}
      >
        <span
          className="font-display text-3xl font-bold tracking-tight"
          aria-hidden
        >
          {placeholder.text}
        </span>
      </div>
    );

  return (
    <li className={cn("min-w-0", className)}>
      <div className="bg-card border-border flex aspect-square flex-col overflow-hidden border">
        <TileLink
          href={href}
          google={google}
          onOpen={onOpenGoogle}
          label={place.name}
          className="focus-visible:ring-primary block h-1/2 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <div className="bg-muted relative h-full w-full overflow-hidden">
            {media(false)}
          </div>
        </TileLink>
        {/* The info band: the image's reflection under a 50% ink layer,
            three rows on it — name, price · category, stars (MESITA-2363). */}
        <div
          className="relative flex h-1/2 shrink-0 items-start overflow-hidden pr-0.5 pl-2.5"
          data-card-reflection
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {media(true)}
          </div>
          <div
            className="bg-foreground/50 pointer-events-none absolute inset-0 backdrop-blur-sm"
            aria-hidden
          />
          <TileLink
            href={href}
            google={google}
            onOpen={onOpenGoogle}
            label={place.name}
            className="focus-visible:ring-primary relative min-w-0 flex-1 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset"
          >
            <p className="font-display text-paper flex min-w-0 items-center gap-1 text-sm leading-tight font-semibold tracking-tight">
              <span className="truncate">{place.name}</span>
              {isEnrichedPlace(place) ? (
                <EnrichedBadge className="h-3.5 w-3.5" />
              ) : null}
            </p>
            {priceLabel || kind ? (
              <p className="text-paper/80 mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-tight">
                {priceLabel ? (
                  <span className="shrink-0">{priceLabel}</span>
                ) : null}
                {kind ? (
                  <span className="truncate">
                    {priceLabel ? "· " : ""}
                    {kind}
                  </span>
                ) : null}
              </p>
            ) : null}
            {ratingLabel ? (
              <p className="text-paper/80 mt-0.5 inline-flex items-center gap-0.5 text-xs leading-tight">
                <Star className="fill-paper text-paper h-3 w-3" />
                {ratingLabel}
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
              className="relative flex h-11 w-11 shrink-0 items-center justify-center"
            >
              <Heart
                className={cn(
                  "h-4 w-4",
                  saved ? "fill-paper text-paper" : "text-paper/80",
                )}
              />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
