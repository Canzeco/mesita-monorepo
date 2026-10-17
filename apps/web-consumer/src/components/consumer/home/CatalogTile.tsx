"use client";

import Image from "next/image";
import Link from "next/link";
import { Heart, Navigation } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { getOpeningStateLabel } from "@/lib/place-state";
import { placeHref } from "@/lib/place-route";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import { cn, firstInitial, formatDistanceKm } from "@/lib/utils";

function readableKind(place: Place): string | null {
  const raw = place.category_label ?? place.category;
  if (!raw || raw.trim().toLowerCase() === "undefined") return null;
  return raw;
}

/**
 * One place in a family carousel. Square photo, facts tight under it,
 * square corners. The row is about 2.5 of these wide. The heart stays
 * a circle. Favs does not use this tile.
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
  const distanceLabel =
    place.distance_km != null && place.distance_km > 0
      ? formatDistanceKm(place.distance_km)
      : null;
  const where = [place.zone, distanceLabel].filter(Boolean).join(" · ");
  const openingLabel = getOpeningStateLabel(place);
  const isOpen = place.open_now === true;
  const priceLabel = formatPlacePriceLevelSymbols(place.price_level);
  const typeLine = [readableKind(place), priceLabel].filter(Boolean).join(" · ");

  return (
    <li className={cn("min-w-0", className)}>
      <div className="bg-card relative">
        <Link
          href={placeHref(place.slug || place.id)}
          className="focus-visible:ring-primary block outline-none focus-visible:ring-2 focus-visible:ring-inset"
        >
          <div className="bg-muted relative aspect-square w-full overflow-hidden">
            {photo ? (
              <Image
                src={photo}
                alt=""
                fill
                sizes="(max-width: 448px) 50vw, 208px"
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
          <div className="flex flex-col gap-0.5 px-2 py-2">
            <p className="font-display text-foreground line-clamp-2 text-sm leading-tight font-semibold tracking-tight">
              {place.name}
            </p>
            {typeLine ? (
              <p className="text-muted-foreground truncate text-sm leading-snug">
                {typeLine}
              </p>
            ) : null}
            <div className="flex min-w-0 flex-col gap-0.5">
              {where ? (
                <p className="text-foreground flex items-start gap-1 text-sm leading-snug">
                  <Navigation className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span className="line-clamp-2">{where}</span>
                </p>
              ) : null}
              {openingLabel ? (
                <p className="inline-flex items-center gap-1.5 text-sm leading-snug font-medium">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      isOpen ? "bg-foreground" : "bg-muted-foreground/40",
                    )}
                  />
                  <span
                    className={
                      isOpen ? "text-foreground" : "text-muted-foreground"
                    }
                  >
                    {openingLabel}
                  </span>
                </p>
              ) : null}
            </div>
          </div>
        </Link>
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
                saved ? "fill-foreground text-muted-foreground" : "text-white",
              )}
            />
          </span>
        </button>
      </div>
    </li>
  );
}
