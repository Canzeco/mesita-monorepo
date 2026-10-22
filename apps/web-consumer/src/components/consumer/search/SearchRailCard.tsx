import Image from "next/image";
import { Star } from "lucide-react";
import { EnrichedBadge } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import { resolvePlaceCategoryName } from "@/lib/place-category";
import { isEnrichedPlace } from "@/lib/place-enriched";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import { cardPhoto, placePlaceholder } from "@/lib/place-placeholder";
import { FamilyIcon } from "@/lib/family-icons";
import { cn, formatCompactCount, formatKm, formatRating } from "@/lib/utils";

/** Every catalog rail card is this tall. Missing subtitle / meta / hours
 *  must not shrink a neighbor — the peek strip has to line up, and the
 *  square thumb stays the same size on every page. */
export const RAIL_CARD_HEIGHT_CLASS = "h-24";

// One floating catalog card on the bottom rail.
// Two-step tap: the first tap on an unselected card just selects it (highlight +
// snap the rail/map onto it); tapping the already-selected card opens its detail.

/** Capitalise every word ("opens tomorrow 07:00" → "Opens Tomorrow 07:00"). */
function titleWords(line: string | null): string | null {
  return line
    ? line.replace(/(^|\s)(\p{Ll})/gu, (_, sp, ch) => sp + ch.toUpperCase())
    : null;
}

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
  const photo = cardPhoto(place);
  const placeholder = placePlaceholder(place);
  const category = resolvePlaceCategoryName({
    categoryLabel: place.category_label,
    category: place.category,
  });
  // THE HOME TILE'S FACTS, THE HOME TILE'S SCALE (Pato, MESITA-2651: "the
  // preview must show the same preview information"): name (+ the Enriched
  // mark); category · $$ · ★ rating (reviews); hours · distance. No zone, as
  // on the tile (MESITA-2645). Inter, name 16px semibold, the rest 14px.
  const o = enrichPlaceOverview(place);
  const priceSymbols = formatPlacePriceLevelSymbols(place.price_level);
  const kindPrice = [category, priceSymbols].filter(Boolean).join(" · ");
  const ratingLabel = formatRating(o.google_rating);
  const reviews =
    typeof o.google_count === "number" && o.google_count > 0
      ? formatCompactCount(o.google_count)
      : null;
  // TITLE CASE ON THE HOURS LINE (Pato, MESITA-2665: "leave it camel case,
  // Opens Tomorrow"): "Closed · Opens Tomorrow 07:00", "Open · Until 02:00".
  // Every row is full ink now, the review count and hours line included
  // (MESITA-2665: "that is too light, I cannot read").
  const openLine = titleWords(
    o.open_now === true
      ? o.closes_at
        ? `Open · until ${o.closes_at}`
        : "Open now"
      : o.open_now === false
        ? o.opens_at
          ? `Closed · opens ${o.opens_at}`
          : "Closed"
        : null,
  );
  const distance =
    typeof place.distance_km === "number" && place.distance_km > 0
      ? formatKm(place.distance_km)
      : null;
  const hoursDistance = [openLine, distance].filter(Boolean).join(" · ");

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
          <span
            className="bg-pink-gradient absolute inset-0 flex items-center justify-center text-lg font-bold text-white"
            data-placeholder={placeholder.kind}
            aria-hidden
          >
            {placeholder.kind === "family" ? (
              <FamilyIcon name={placeholder.family} className="h-7 w-7" />
            ) : (
              placeholder.text
            )}
          </span>
        )}
      </div>
      {/* Three rows always, each a fixed slot so a sparse place is the
          same box as a full one (the rail must line up). */}
      <div className="grid min-h-0 min-w-0 flex-1 grid-rows-[1.5rem_1.25rem_1.25rem] content-center gap-1 py-2 pr-2 pl-3 font-sans">
        <p className="flex h-6 min-w-0 items-center gap-1 text-base leading-6 font-semibold tracking-tight">
          <span className="truncate">{place.name}</span>
          {isEnrichedPlace(place) ? <EnrichedBadge /> : null}
        </p>
        <p className="text-foreground flex h-5 min-w-0 items-center gap-1 text-sm leading-5">
          {kindPrice ? <span className="truncate">{kindPrice}</span> : null}
          {kindPrice && ratingLabel ? (
            <span aria-hidden className="shrink-0">
              ·
            </span>
          ) : null}
          {ratingLabel ? (
            <span className="inline-flex shrink-0 items-center gap-1">
              <Star className="fill-foreground text-foreground h-3.5 w-3.5 shrink-0" />
              {ratingLabel}
              {reviews ? <span>({reviews})</span> : null}
            </span>
          ) : null}
        </p>
        <p className="text-foreground h-5 truncate text-sm leading-5">
          {hoursDistance}
        </p>
      </div>
    </button>
  );
}
