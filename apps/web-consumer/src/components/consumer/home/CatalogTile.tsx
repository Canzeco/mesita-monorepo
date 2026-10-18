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
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import { cn, formatCompactCount, formatKm, formatRating } from "@/lib/utils";

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
 * One place, as one square tile (Pato, MESITA-2364, MESITA-2373): the photo
 * on the top 60%, its light reflection below carrying four rows — name with
 * the heart at its right; price · category; zone · open state; stars ·
 * distance (MESITA-2374). No zone. An
 * enriched place wears the Enriched mark after its name
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
  // The same real-data mapper the detail Overview reads (MESITA-2371): stars,
  // review count, price range, open state, zone — a missing cell hides.
  const o = enrichPlaceOverview(place);
  // "MX$200–300 per person" truncated the row; the tile keeps the range.
  const priceLabel =
    o.price_range?.replace(/\s*per person$/i, "") ??
    formatPlacePriceLevelSymbols(place.price_level);
  const kind = readableKind(place);
  const ratingLabel = formatRating(o.google_rating);
  const reviews =
    typeof o.google_count === "number" && o.google_count > 0
      ? formatCompactCount(o.google_count)
      : null;
  const zone = o.zone?.trim() || null;
  const openLine =
    o.open_now === true
      ? o.closes_at
        ? `Open · until ${o.closes_at}`
        : "Open now"
      : o.open_now === false
        ? o.opens_at
          ? `Closed · opens ${o.opens_at}`
          : "Closed"
        : null;
  const distance =
    typeof place.distance_km === "number" && place.distance_km > 0
      ? formatKm(place.distance_km)
      : null;
  // Four rows (Pato, MESITA-2373, after three in MESITA-2372): name;
  // stars · price; category · zone; open state · distance.
  // Pato's order (MESITA-2374): Name (+ Save at the right) · Price,
  // Category · Zone, Time · Stars (and distance).
  const priceKind = [priceLabel, kind].filter(Boolean).join(" · ");
  const zoneTime = [zone, openLine].filter(Boolean).join(" · ");

  // The photo, or the Google card's emoji tile. Drawn twice: on the top
  // 60%, and flipped from its foot as the reflection below it.
  const media = () =>
    photo ? (
      <Image
        src={photo}
        alt=""
        fill
        sizes="(max-width: 448px) 66vw, 300px"
        className="object-cover object-center"
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
    );

  // ONE square (Pato, MESITA-2369, MESITA-2373): the photo is the top 60%,
  // fully shown and centred — nothing lies over it. The bottom 40% is its
  // REFLECTION: a 60%-tall copy flipped so its foot meets the photo's foot,
  // under an 80% paper layer, four rows on it in dark text. No border, no
  // radius; the heart sits at the right of the name row.
  return (
    <li className={cn("relative aspect-square min-w-0 overflow-hidden", className)}>
      <TileLink
        href={href}
        google={google}
        onOpen={onOpenGoogle}
        label={place.name}
        className="focus-visible:ring-primary absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <div className="bg-muted absolute inset-x-0 top-0 h-[60%] overflow-hidden">
          {media()}
        </div>
        {/* The reflection: bottom 40%, the photo mirrored from its foot under
            80% paper (MESITA-2375), four rows spread to fill it (MESITA-2373). */}
        <div
          className="absolute inset-x-0 bottom-0 h-[40%] overflow-hidden"
          data-tile-info
        >
          <div
            className="absolute inset-x-0 top-0 h-[150%] -scale-y-100"
            aria-hidden
            data-tile-reflection
          >
            {media()}
          </div>
          <div
            className="bg-paper/80 absolute inset-0 backdrop-blur-sm"
            aria-hidden
          />
          <div className="text-foreground relative flex h-full flex-col justify-evenly px-3 py-1.5">
            <p
              className={cn(
                "font-display flex min-w-0 items-center gap-1 text-base leading-tight font-semibold tracking-tight",
                !google && "pr-9",
              )}
            >
              <span className="truncate">{place.name}</span>
              {isEnrichedPlace(place) ? (
                <EnrichedBadge className="h-4 w-4 shrink-0" />
              ) : null}
            </p>
            {priceKind ? (
              <p className="truncate text-sm leading-tight font-medium">{priceKind}</p>
            ) : null}
            {zoneTime ? (
              <p className="text-muted-foreground truncate text-sm leading-tight">{zoneTime}</p>
            ) : null}
            {ratingLabel || distance ? (
              <p className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-sm leading-tight">
                {ratingLabel ? (
                  <span className="text-foreground inline-flex shrink-0 items-center gap-1 font-medium">
                    <Star className="fill-foreground text-foreground h-3.5 w-3.5" />
                    {ratingLabel}
                    {reviews ? (
                      <span className="text-muted-foreground font-normal">({reviews})</span>
                    ) : null}
                  </span>
                ) : null}
                {ratingLabel && distance ? <span aria-hidden>·</span> : null}
                {distance ? <span className="truncate">{distance}</span> : null}
              </p>
            ) : null}
          </div>
        </div>
      </TileLink>
      {google ? null : (
        <button
          type="button"
          onClick={onToggle}
          aria-label={
            saved ? `Remove ${place.name} from saved` : `Save ${place.name}`
          }
          // The Save heart sits at the right of the name row (Pato,
          // MESITA-2374), a sibling of the tile link so a tap never navigates.
          className="absolute top-[60%] right-0 flex h-11 w-11 items-center justify-center"
          data-tile-save
        >
          <Heart
            className={cn(
              "h-5 w-5",
              saved ? "fill-foreground text-foreground" : "text-foreground",
            )}
          />
        </button>
      )}
    </li>
  );
}
