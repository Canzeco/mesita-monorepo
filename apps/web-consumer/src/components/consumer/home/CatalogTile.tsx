"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, Share2, Star } from "lucide-react";
import { EnrichedBadge } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { isEnrichedPlace } from "@/lib/place-enriched";
import { placeHref } from "@/lib/place-route";
import { sharePlace } from "@/lib/share-place";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import {
  cardPhoto,
  isGoogleOnlyPlace,
  placePlaceholder,
} from "@/lib/place-placeholder";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import { FamilyIcon } from "@/lib/family-icons";
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
  onTap,
  label,
  className,
  children,
}: {
  href: string;
  /** A Google-only card is a button, never a link to a page it has no row for. */
  google: boolean;
  /** The parent's explicit open for that button. */
  onOpen?: () => void;
  /** Any tap, either kind: the parent's analytics (MESITA-2384). */
  onTap?: () => void;
  label: string;
  className: string;
  children: ReactNode;
}) {
  if (google) {
    return (
      <button
        type="button"
        onClick={() => {
          onTap?.();
          onOpen?.();
        }}
        aria-label={`Open ${label}`}
        className={`${className} w-full text-left`}
      >
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={className} onClick={onTap}>
      {children}
    </Link>
  );
}

// The place screen's action tile, on one line (MESITA-2650): 44px, the
// border grey at 60% (MESITA-2647), rounded-lg, 12px semibold ink.
const TILE_BUTTON =
  "bg-border/60 text-foreground hover:bg-border/80 flex h-11 min-w-0 items-center justify-center gap-1.5 rounded-lg px-2 font-sans text-xs font-semibold transition active:scale-[0.99]";

function readableKind(place: Place): string | null {
  const raw = place.category_label ?? place.category;
  if (!raw || raw.trim().toLowerCase() === "undefined") return null;
  return raw;
}

/**
 * One place, as one tile (Pato, MESITA-2364, MESITA-2373): the photo on top,
 * its light reflection below carrying three rows — name; category · $$ ·
 * stars; hours · distance (MESITA-2645) — and two buttons, Like and Share
 * (MESITA-2650). An
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
  onOpen,
  className,
}: {
  place: Place;
  saved: boolean;
  onToggle: () => void;
  /** Any open of the tile, for analytics (MESITA-2384). */
  onOpen?: () => void;
  /** The explicit open for a Google-only card (get-or-create, then route). */
  onOpenGoogle?: () => void;
  className?: string;
}) {
  const photo = cardPhoto(place);
  const placeholder = placePlaceholder(place);
  const google = isGoogleOnlyPlace(place);
  const href = placeHref(place.slug || place.id);
  // The same real-data mapper the detail Overview reads (MESITA-2371): stars,
  // review count, price range, open state — a missing cell hides.
  const o = enrichPlaceOverview(place);
  // PRICE FOR DUMMIES, HERE ONLY (Pato, MESITA-2645: "price must be price
  // range for dummies ($, $$, $$$, $$$$), just here in the home preview"):
  // the price level as dollar signs, never "MX$200–300" on a tile. The place
  // screen keeps the range.
  const priceLabel = formatPlacePriceLevelSymbols(place.price_level);
  const kind = readableKind(place);
  const ratingLabel = formatRating(o.google_rating);
  const reviews =
    typeof o.google_count === "number" && o.google_count > 0
      ? formatCompactCount(o.google_count)
      : null;
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
  // THREE ROWS, PATO'S ORDER (MESITA-2645: "the same fields as in the
  // header"): name (+ the Enriched mark); category · $$ · stars; hours ·
  // distance. No zone on the tile. Each cell hides when the place has none.
  const kindPrice = [kind, priceLabel].filter(Boolean).join(" · ");
  const hoursDistance = [openLine, distance].filter(Boolean).join(" · ");

  // The photo, or the Google card's family icon (a line icon, never the
  // emoji: MESITA-2478). Drawn twice: on the top
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
        {placeholder.kind === "family" ? (
          <FamilyIcon name={placeholder.family} className="h-10 w-10" />
        ) : (
          <span
            className="font-display text-3xl font-bold tracking-tight"
            aria-hidden
          >
            {placeholder.text}
          </span>
        )}
      </div>
    );

  // TWO BIG BUTTONS, LIKE AND SHARE (Pato, MESITA-2650: "add the button to
  // like and the button share; share must be almost everywhere to maximize
  // sharing and the virality of the app"). They need room, so a Mesita tile
  // is 5:6 — photo top half (still 5:3), band bottom half — while a
  // Google-only card, which has no page to share or save, stays the square
  // below with no buttons.
  //
  // ONE square (Pato, MESITA-2369, MESITA-2373): the photo is the top 60%,
  // fully shown and centred — nothing lies over it. The bottom 40% is its
  // REFLECTION: a 60%-tall copy flipped so its foot meets the photo's foot,
  // under an 80% paper layer, three rows on it in dark text. No border; the
  // corners are rounded-2xl — and the photo, the band and its blur layer
  // carry the same radius themselves, because a backdrop-blur layer escapes
  // its parent's rounded clip and painted the bottom corners square
  // (MESITA-2429). Like and Share sit on the band's foot.
  return (
    <li
      className={cn(
        "relative isolate min-w-0 overflow-hidden rounded-2xl",
        google ? "aspect-square" : "aspect-[5/6]",
        className,
      )}
    >
      <TileLink
        href={href}
        google={google}
        onOpen={onOpenGoogle}
        onTap={onOpen}
        label={place.name}
        className="focus-visible:ring-primary absolute inset-0 block outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        <div
          className={cn(
            "bg-muted absolute inset-x-0 top-0 overflow-hidden rounded-t-2xl",
            google ? "h-[60%]" : "h-1/2",
          )}
        >
          {media()}
        </div>
        {/* The reflection: bottom 40%, the photo mirrored from its foot under
            80% paper (MESITA-2375), the three rows centred on it (MESITA-2645). */}
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 overflow-hidden rounded-b-2xl",
            google ? "h-[40%]" : "h-1/2",
          )}
          data-tile-info
        >
          <div
            className={cn(
              "absolute inset-x-0 top-0 -scale-y-100",
              google ? "h-[150%]" : "h-full",
            )}
            aria-hidden
            data-tile-reflection
          >
            {media()}
          </div>
          <div
            className="bg-paper/80 absolute inset-0 rounded-b-2xl backdrop-blur-sm"
            aria-hidden
          />
          {/* ONE TYPE SCALE (Pato, MESITA-2645: "standardize fonts and sizes
              and spaces"): the place screen's own (packages/place-profile
              ui.ts). Inter everywhere, two sizes only: the name 16px
              semibold ink (PLACE_TITLE_CLASS); every other row 14px regular,
              20px line, ink for the facts, muted for hours · distance. The
              rows sit centred with one 4px gap and 12px side padding — the
              same rhythm on every tile. The mark follows the name. */}
          <div
            className={cn(
              "text-foreground relative flex h-full flex-col justify-center gap-1 pl-3",
              google ? "pr-3" : "pr-3 pb-[60px]",
            )}
          >
            <p className="flex min-w-0 items-center gap-1 font-sans text-base leading-6 font-semibold tracking-tight">
              <span className="truncate">{place.name}</span>
              {isEnrichedPlace(place) ? <EnrichedBadge /> : null}
            </p>
            {kindPrice || ratingLabel ? (
              <p className="flex min-w-0 items-center gap-1 font-sans text-sm leading-5">
                {kindPrice ? (
                  <span className="truncate">{kindPrice}</span>
                ) : null}
                {kindPrice && ratingLabel ? (
                  <span aria-hidden className="shrink-0">
                    ·
                  </span>
                ) : null}
                {ratingLabel ? (
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Star className="fill-foreground text-foreground h-3.5 w-3.5 shrink-0" />
                    {ratingLabel}
                    {reviews ? (
                      <span className="text-muted-foreground">({reviews})</span>
                    ) : null}
                  </span>
                ) : null}
              </p>
            ) : null}
            {hoursDistance ? (
              <p className="text-muted-foreground truncate font-sans text-sm leading-5">
                {hoursDistance}
              </p>
            ) : null}
          </div>
        </div>
      </TileLink>
      {google ? null : (
        // The place screen's action tiles, smaller row (MESITA-2647's grey):
        // two equal 44px buttons, icon + label on one line, 12px from the
        // band's edges. Siblings of the tile link, so a tap never navigates.
        <div
          className="absolute inset-x-3 bottom-3 grid grid-cols-2 gap-2"
          data-tile-actions
        >
          <button
            type="button"
            onClick={onToggle}
            aria-label={
              saved
                ? `Remove ${place.name} from favorites`
                : `Add ${place.name} to favorites`
            }
            className={TILE_BUTTON}
            data-tile-save
          >
            <Heart
              className={cn(
                "h-4 w-4 shrink-0",
                saved && "fill-destructive text-destructive",
              )}
              strokeWidth={2.25}
              aria-hidden
            />
            {saved ? "Liked" : "Like"}
          </button>
          <button
            type="button"
            onClick={() => void sharePlace(place)}
            aria-label={`Share ${place.name}`}
            className={TILE_BUTTON}
            data-tile-share
          >
            <Share2
              className="h-4 w-4 shrink-0"
              strokeWidth={2.25}
              aria-hidden
            />
            Share
          </button>
        </div>
      )}
    </li>
  );
}
