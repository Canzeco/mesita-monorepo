"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Star } from "lucide-react";
import { EnrichedBadge } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { isEnrichedPlace } from "@/lib/place-enriched";
import { placeHref } from "@/lib/place-route";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import { cn, firstInitial, formatRating } from "@/lib/utils";

function readableKind(place: Place): string | null {
  const raw = place.category_label ?? place.category;
  if (!raw || raw.trim().toLowerCase() === "undefined") return null;
  return raw;
}

/**
 * One place in a family rail, in the OpenTable shape: a rounded
 * photo, the name with the save heart beside it, then price, the Google
 * category, and the Google stars. No zone. The row is about 2.5 of
 * these wide. An enriched place wears the Enriched mark after its name
 * (MESITA-2296). Favs does not use this tile.
 */
export function CatalogTile({
  place,
  saved,
  onToggle,
  className,
}: {
  place: Place;
  saved: boolean;
  onToggle: () => void;
  className?: string;
}) {
  const photo = place.photos[0];
  const href = placeHref(place.slug || place.id);
  const priceLabel = formatPlacePriceLevelSymbols(place.price_level);
  const kind = readableKind(place);
  const ratingLabel = formatRating(place.google_rating);
  const facts = [priceLabel, kind, ratingLabel].filter(Boolean);

  return (
    <li className={cn("min-w-0", className)}>
      <div className="bg-card border-border overflow-hidden rounded-2xl border">
        <Link
          href={href}
          className="focus-visible:ring-primary block outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <div className="bg-muted relative aspect-[3/2] w-full overflow-hidden">
            {photo ? (
              <Image
                src={photo}
                alt=""
                fill
                sizes="(max-width: 448px) 40vw, 180px"
                className="object-cover"
              />
            ) : (
              <div className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-white/90">
                <span className="font-display text-3xl font-bold tracking-tight">
                  {firstInitial(place.name)}
                </span>
              </div>
            )}
          </div>
        </Link>
        <div className="flex items-center pr-0.5 pl-2.5">
          <Link
            href={href}
            className="focus-visible:ring-primary min-w-0 flex-1 py-2 outline-none focus-visible:ring-2 focus-visible:ring-inset"
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
          </Link>
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
        </div>
      </div>
    </li>
  );
}
