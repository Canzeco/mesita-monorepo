"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Navigation } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { PromoChip } from "@/components/consumer/PromoChip";
import { getOpeningStatusLabel } from "@/lib/place-status";
import { placeHref } from "@/lib/place-route";
import { cn, firstInitial, formatDistanceKm } from "@/lib/utils";

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
// 3:4 is the WHOLE CARD, not the photo (Pato, 2026-08-10). Ratio on the photo
// alone stacked the caption underneath and the tile read far too tall; now the
// card is 3:4 and the photo takes whatever the caption leaves.
export function FavoriteTile({
  place,
  saved,
  onToggle,
}: {
  place: Place;
  /** Filled heart (in your saves) vs outline (a suggestion you can save). */
  saved: boolean;
  onToggle: () => void;
}) {
  const photo = place.photos[0];
  // Favorites omit the chip when unknown; formatDistanceKm's "- km" would
  // clutter the subtitle, so only pass through a real distance.
  const distanceLabel =
    place.distance_km != null && place.distance_km > 0
      ? formatDistanceKm(place.distance_km)
      : null;
  const subtitle = [place.zone, distanceLabel].filter(Boolean).join(" · ");
  const openingLabel = getOpeningStatusLabel(place);
  const isOpen = place.open_now === true;

  return (
    <li className="min-w-0">
      <div className="border-border bg-card hover:shadow-rest relative flex aspect-[3/4] flex-col overflow-hidden rounded-2xl border transition">
        {/* Photo + text navigate to the place; the heart is a separate control
            (interactive elements can't nest inside an <a>). */}
        <Link
          href={placeHref(place.slug || place.id)}
          className="focus-visible:ring-primary flex min-w-0 flex-1 flex-col rounded-2xl transition outline-none focus-visible:ring-2 active:scale-[0.99]"
        >
          <div className="bg-muted relative min-h-0 w-full flex-1 overflow-hidden">
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

          {/* The text block keeps its natural height; the photo absorbs what's
              left. At 200% text the block outgrows the ratio and the card
              grows with it (an aspect-ratio box never shrinks below its
              content) instead of clipping a row. */}
          <div className="flex min-w-0 shrink-0 flex-col p-2.5">
            <p className="font-display text-foreground truncate text-sm font-semibold tracking-tight">
              {place.name}
            </p>
            {subtitle && (
              <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                <Navigation className="h-3 w-3 shrink-0" />
                <span className="truncate">{subtitle}</span>
              </p>
            )}
            {/* Opening status + reward summary. Each child self-hides when the
                tile lacks data (no hours table, or a place with no reward), so
                an info-less tile just shows its name + location. */}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 empty:mt-0">
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
