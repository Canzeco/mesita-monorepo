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
 * One place in a rail, as an Instagram grid tile (Pato, MESITA-2364): the
 * square photo edge to edge, the name and price · category · stars over an
 * solid white band at its foot, the save heart top right. No zone. An enriched
 * place wears the Enriched mark after its name
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
  const meta = [priceLabel, kind].filter(Boolean).join(" · ");

  // An Instagram grid tile (Pato, MESITA-2364): the photo — or the Google
  // card's emoji tile — fills the square edge to edge, no border, no radius.
  // The info lies on a solid white band at the foot, dark text — no
  // gradient (Pato, MESITA-2365: "either transparent or completely white");
  // the heart sits top right.
  return (
    <li className={cn("relative aspect-square min-w-0 overflow-hidden", className)}>
      <TileLink
        href={href}
        google={google}
        onOpen={onOpenGoogle}
        label={place.name}
        className="focus-visible:ring-primary absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <div className="bg-muted absolute inset-0">
          {photo ? (
            <Image
              src={photo}
              alt=""
              fill
              sizes="(max-width: 448px) 30vw, 150px"
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
        <div
          className="bg-card absolute inset-x-0 bottom-0 px-1.5 py-1"
          data-tile-info
        >
          <p className="font-display text-foreground flex min-w-0 items-center gap-1 text-xs leading-tight font-semibold tracking-tight">
            <span className="truncate">{place.name}</span>
            {isEnrichedPlace(place) ? (
              <EnrichedBadge className="h-3 w-3 shrink-0" />
            ) : null}
          </p>
          {meta || ratingLabel ? (
            <p className="text-muted-foreground mt-0.5 flex min-w-0 items-center gap-1 text-xs leading-tight">
              {meta ? <span className="truncate">{meta}</span> : null}
              {ratingLabel ? (
                <span className="inline-flex shrink-0 items-center gap-0.5">
                  {meta ? <span aria-hidden>·</span> : null}
                  <Star className="fill-foreground text-foreground h-3 w-3" />
                  {ratingLabel}
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </TileLink>
      {google ? null : (
        <button
          type="button"
          onClick={onToggle}
          aria-label={
            saved ? `Remove ${place.name} from saved` : `Save ${place.name}`
          }
          className="absolute top-0 right-0 flex h-11 w-11 items-start justify-end p-1.5"
        >
          <span className="bg-card flex h-6 w-6 items-center justify-center rounded-full">
            <Heart
              className={cn(
                "h-3.5 w-3.5",
                saved ? "fill-foreground text-foreground" : "text-foreground",
              )}
            />
          </span>
        </button>
      )}
    </li>
  );
}
