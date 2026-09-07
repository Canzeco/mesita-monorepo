"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Navigation, Star } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { PromoChip } from "@/components/consumer/PromoChip";
import { getOpeningStateLabel } from "@/lib/place-state";
import { placeHref } from "@/lib/place-route";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import {
  cn,
  firstInitial,
  formatDistanceKm,
  formatRating,
} from "@/lib/utils";

// One place tile in the Favorites grid.
//
// Replaces the old 64px-thumbnail row. A place is chosen by what the room
// looks like, so the photo is the content: a tile gives it ~31,000px² against
// the row's 4,096px², at slightly BETTER vertical density (≈107px per place vs
// 114px). Two columns is a discovery pattern — it belongs here and on nothing
// in /rewards, where a ticket is scanned for state, not browsed for looks.
//
// Every tile is the SAME size (Pato, 2026-08-10): a plain 2-column grid, no
// hero span on odd counts. An earlier pass gave the first tile a full-width
// 16:9 crop to avoid the trailing gap — that's out, the even rhythm wins.
//
// TWO STACKED 4:3 BOXES — a 4:3 photo over a 4:3 body (Pato, MESITA-1624:
// "cards must be 4/3 + 4/3, to display lots of info"). The card is therefore
// 2:3 overall: at Feed's ~176px column that is a 132px photo over a 132px
// body, ~264px tall.
//
// THIS OVERTURNS THE 2026-08-10 CALL, deliberately and on instruction. That
// pass made 3:4 the WHOLE CARD with the photo taking whatever the caption
// left, because ratio-on-the-photo-alone "stacked the caption underneath and
// the tile read far too tall". Both halves of that are still true — the card
// IS taller now, and the caption IS stacked under a fixed photo. What changed
// is what the caption is for: it was three lines of chrome under a hero photo
// and is now the half of the card that carries the facts, so the height it
// costs is the point rather than the side effect. Do not "restore" the old
// ratio without reading the info block below first.
//
// THE BODY IS AN ASPECT BOX, NOT A FIXED HEIGHT. `aspect-[4/3]` is a floor:
// at large accessibility text the rows outgrow it and the box grows with
// them, the same property the old whole-card ratio relied on. `justify-
// between` spreads the rows so a place missing its rating or price does not
// leave the gap at the bottom.
export function FavoriteTile({
  place,
  saved,
  onToggle,
  className,
}: {
  place: Place;
  /** Filled heart (in your saves) vs outline (a suggestion you can save). */
  saved: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const photo = place.photos[0];
  // Favorites omit the chip when unknown; formatDistanceKm's "- km" would
  // clutter the subtitle, so only pass through a real distance.
  const distanceLabel =
    place.distance_km != null && place.distance_km > 0
      ? formatDistanceKm(place.distance_km)
      : null;
  const subtitle = [place.zone, distanceLabel].filter(Boolean).join(" · ");
  const openingLabel = getOpeningStateLabel(place);
  const isOpen = place.open_now === true;
  // The three facts the body gained with its height. Each self-hides when the
  // place lacks it — a bare catalog row still reads, it just reads shorter.
  // No fabrication: `enrichPlaceOverview` leaves a genuinely missing cell null
  // and these follow it.
  const priceLabel = formatPlacePriceLevelSymbols(place.price_level);
  const ratingLabel = formatRating(place.google_rating);
  const reviewCount = place.google_count ?? null;
  const categoryLabel = place.category_label ?? place.category ?? null;
  const typeLine = [categoryLabel, priceLabel].filter(Boolean).join(" · ");

  return (
    <li className={cn("min-w-0", className)}>
      <div className="border-border bg-card hover:shadow-rest relative flex flex-col overflow-hidden rounded-2xl border transition">
        {/* Photo + text navigate to the place; the heart is a separate control
            (interactive elements can't nest inside an <a>). */}
        <Link
          href={placeHref(place.slug || place.id)}
          className="focus-visible:ring-primary flex min-w-0 flex-col rounded-2xl transition outline-none focus-visible:ring-2 active:scale-[0.99]"
        >
          {/* BOX ONE — 4:3, fixed. `shrink-0` so a long name in the body can
              never crop the photo; the body grows downward instead. */}
          <div className="bg-muted relative aspect-[4/3] w-full shrink-0 overflow-hidden">
            {photo ? (
              <Image
                src={photo}
                alt={place.name}
                fill
                sizes="(max-width: 448px) 50vw, 208px"
                className="object-cover"
              />
            ) : (
              <div className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-white/85">
                <span className="font-display text-3xl font-bold tracking-tight">
                  {firstInitial(place.name)}
                </span>
              </div>
            )}
          </div>

          {/* BOX TWO — 4:3 as a FLOOR, matching the photo above it. The rows
              are ordered by what a guest scans for: who it is, what it is,
              how good, how far, and whether it is open right now with a
              reward on it. Every row self-hides, so a bare catalog row still
              reads — it just leaves the box short of its own ratio rather
              than printing an empty cell. */}
          <div className="flex aspect-[4/3] min-w-0 flex-col justify-between gap-1 p-2.5">
            <div className="min-w-0">
              <p className="font-display text-foreground truncate text-sm font-semibold tracking-tight">
                {place.name}
              </p>
              {typeLine && (
                <p className="text-muted-foreground type-label mt-0.5 truncate">
                  {typeLine}
                </p>
              )}
            </div>

            <div className="flex min-w-0 flex-col gap-1">
              {ratingLabel && (
                <p className="type-label flex items-center gap-1">
                  <Star className="h-3 w-3 shrink-0 fill-amber-400 text-amber-400" />
                  <span className="text-foreground font-semibold">
                    {ratingLabel}
                  </span>
                  {reviewCount != null && (
                    <span className="text-muted-foreground truncate">
                      ({reviewCount})
                    </span>
                  )}
                </p>
              )}
              {subtitle && (
                <p className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Navigation className="h-3 w-3 shrink-0" />
                  <span className="truncate">{subtitle}</span>
                </p>
              )}
              {/* Opening state + reward summary. Each child self-hides when
                  the tile lacks data (no hours table, or a place with no
                  reward), so an info-less tile just shows its name. */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {openingLabel && (
                  <span className="type-label inline-flex items-center gap-1 font-medium">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        isOpen ? "bg-emerald-500" : "bg-muted-foreground/40",
                      )}
                    />
                    <span
                      className={
                        isOpen ? "text-emerald-600" : "text-muted-foreground"
                      }
                    >
                      {openingLabel}
                    </span>
                  </span>
                )}
                <PromoChip place={place} size="sm" />
              </div>
            </div>
          </div>
        </Link>

        {/* 44px hit area around a 32px visual circle. The old row shipped a
            bare h-8 w-8 button — under every touch-target guideline, and the
            tile makes it worse by putting it over a photo. */}
        <button
          type="button"
          onClick={onToggle}
          aria-label={
            saved ? `Remove ${place.name} from saved` : `Save ${place.name}`
          }
          className="absolute top-1 right-1 flex h-11 w-11 items-center justify-center"
        >
          <span
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition active:scale-90",
              saved
                ? "bg-white/90 hover:bg-white"
                : "bg-black/35 hover:bg-black/50",
            )}
          >
            <Heart
              className={cn(
                "h-4 w-4",
                saved ? "fill-rose-500 text-rose-500" : "text-white",
              )}
            />
          </span>
        </button>
      </div>
    </li>
  );
}
