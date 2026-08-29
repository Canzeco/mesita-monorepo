import Image from "next/image";
import { BadgeCheck, Star } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { getOpeningStatusLabel } from "@/lib/place-status";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import { cn, firstInitial, formatKm, formatRating } from "@/lib/utils";
import { isPromoting } from "@/lib/promo-rates";

/** Every catalog rail card is this tall. Missing subtitle / meta / hours
 *  must not shrink a neighbor — the peek strip has to line up, and the
 *  square thumb stays the same size on every page. */
export const RAIL_CARD_HEIGHT_CLASS = "h-24";

// One floating catalog card on the bottom rail.
// Two-step tap: the first tap on an unselected card just selects it (highlight +
// snap the rail/map onto it); tapping the already-selected card opens its detail.
export function RailCard({
  place,
  selected,
  onSelect,
  onOpen,
}: {
  place: Place;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
}) {
  const photo = place.photos[0];
  const category = resolvePlaceCategoryName({
    categoryLabel: place.category_label,
    category: place.category,
  });
  const subtitle = [category, place.zone].filter(Boolean).join(" · ");
  const openingLabel = getOpeningStatusLabel(place);
  const isOpen = place.open_now === true;
  const priceSymbols = formatPlacePriceLevelSymbols(place.price_level);
  const hasMeta =
    place.google_rating != null ||
    priceSymbols != null ||
    place.distance_km != null;

  return (
    <button
      type="button"
      onClick={selected ? onOpen : onSelect}
      className={cn(
        "border-border bg-card/95 shadow-elev flex w-full items-stretch overflow-hidden rounded-2xl border text-left backdrop-blur transition active:scale-[0.98]",
        RAIL_CARD_HEIGHT_CLASS,
        selected && "border-primary ring-primary/30 ring-2 ring-inset",
      )}
    >
      {/* Square thumb, card stays a wide rectangle. Bleeds to the card edge
          — clip only, no inner radius or stroke. Height is the locked card
          height; width matches so the box is always 1:1. */}
      <div className="bg-muted relative aspect-square h-full w-auto shrink-0 overflow-hidden">
        {photo ? (
          <Image
            src={photo}
            alt={place.name}
            fill
            sizes="120px"
            className="border-0 object-cover outline-none"
          />
        ) : (
          <span className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
            {firstInitial(place.name)}
          </span>
        )}
      </div>
      {/* Four rows always: name / subtitle / meta / status. Empty rows still
          occupy the slot so a sparse place is the same box as a full one. */}
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[1.25rem_repeat(3,1rem)] content-center gap-1 py-2 pr-2 pl-2.5">
        <span className="flex h-5 items-center gap-1">
          <span className="truncate text-sm leading-5 font-semibold">
            {place.name}
          </span>
          {isPromoting(place) && (
            <BadgeCheck
              className="text-primary h-3.5 w-3.5 shrink-0"
              aria-label="Mesita reward here"
            />
          )}
        </span>
        <p className="text-muted-foreground type-label h-4 truncate leading-4">
          {subtitle}
        </p>
        <p className="text-muted-foreground type-label flex h-4 items-center gap-1 leading-4">
          {hasMeta && (
            <>
              {place.google_rating != null && (
                <span className="flex items-center gap-1">
                  <Star className="h-2.5 w-2.5 shrink-0 fill-amber-400 text-amber-400" />
                  {formatRating(place.google_rating)}
                </span>
              )}
              {priceSymbols && (
                <span className="flex items-center gap-1">
                  {place.google_rating != null && <span>·</span>}
                  <span>{priceSymbols}</span>
                </span>
              )}
              {place.distance_km != null && (
                <span className="flex items-center gap-1">
                  {(place.google_rating != null || priceSymbols != null) && (
                    <span>·</span>
                  )}
                  <span>{formatKm(place.distance_km)}</span>
                </span>
              )}
            </>
          )}
        </p>
        <span className="type-label flex h-4 items-center gap-1.5 leading-4 font-medium">
          {openingLabel && (
            <>
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  isOpen ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
              <span
                className={cn(
                  "truncate",
                  isOpen ? "text-emerald-600" : "text-muted-foreground",
                )}
              >
                {openingLabel}
              </span>
            </>
          )}
        </span>
      </div>
    </button>
  );
}
