import Image from "next/image";
import { BadgeCheck, Star } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { getOpeningStatusLabel } from "@/lib/place-status";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import { cn, firstInitial, formatKm, formatRating } from "@/lib/utils";
import { isPromoting } from "@/lib/promo-rates";

// One floating catalog card on the bottom rail.
// Two-step tap: the first tap on an unselected card just selects it (highlight +
// centre the rail/map on it); tapping the already-selected card opens its detail.
export function RailCard({
  place,
  selected,
  onSelect,
  onOpen,
  cardRef,
}: {
  place: Place;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  cardRef: (el: HTMLButtonElement | null) => void;
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
      ref={cardRef}
      type="button"
      onClick={selected ? onOpen : onSelect}
      className={cn(
        "border-border bg-card/95 shadow-elev flex w-[288px] shrink-0 items-center gap-3 rounded-2xl border p-2 text-left backdrop-blur transition active:scale-[0.98]",
        selected && "border-primary ring-primary/30 ring-2",
      )}
    >
      <div className="bg-muted border-border relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border">
        {photo ? (
          <Image
            src={photo}
            alt={place.name}
            fill
            sizes="80px"
            className="object-cover"
          />
        ) : (
          <span className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-lg font-bold text-white">
            {firstInitial(place.name)}
          </span>
        )}
      </div>
      {/* Text column — a strict 4-row grid (name / subtitle / meta / status)
          with one uniform gap and one type size + leading for the secondary
          rows, centred against the 80px photo. Meta items join with the same
          "·" separator as the subtitle so the block reads as ordered lines,
          not floating fragments. */}
      <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 py-0.5">
        <span className="flex items-center gap-1">
          <span className="truncate text-sm leading-tight font-semibold">
            {place.name}
          </span>
          {isPromoting(place) && (
            <BadgeCheck
              className="text-primary h-3.5 w-3.5 shrink-0"
              aria-label="Mesita reward here"
            />
          )}
        </span>
        {subtitle && (
          <p className="text-muted-foreground type-label truncate leading-4">
            {subtitle}
          </p>
        )}
        {hasMeta && (
          <p className="text-muted-foreground type-label flex items-center gap-1 leading-4">
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
          </p>
        )}
        {openingLabel && (
          <span className="type-label flex items-center gap-1.5 leading-4 font-medium">
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
          </span>
        )}
      </div>
    </button>
  );
}
