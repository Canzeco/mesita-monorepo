import Image from "next/image";
import { EnrichedBadge } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { isEnrichedPlace } from "@/lib/place-enriched";
import { cardPhoto, placePlaceholder } from "@/lib/place-placeholder";
import { cn } from "@/lib/utils";
import {
  CardActions,
  HoursRow,
  KindRow,
  cardFacts,
} from "@/components/consumer/place-card";

// TALLER, FOUR ROWS (Pato, MESITA-2668: "make the profile bigger here.
// taller", then "include the buttons to see: Name / Category, Price Range /
// Hours / Like Share"): 12px inside on every side, the three text rows
// (64px), 12px, then Save and Share (32px). 134px with the 1px border; the
// photo is the inner height, square. No distance on this card: "the map is
// implicit".

/** Every catalog rail card is this tall. Missing rows must not shrink a
 *  neighbor — the peek strip has to line up, and the square thumb stays the
 *  same size on every page. */
export const RAIL_CARD_HEIGHT_CLASS = "h-[8.375rem]";
/** The carousel row around the card: the card, its 8px pads and the 4px
 *  scrollbar gutter, plus 4px of air (MESITA-2510's fixed band). */
export const RAIL_ROW_HEIGHT_CLASS = "h-[9.875rem]";
/** The whole band under the map: the readout's 7.5rem and the carousel row. */
export const RAIL_BAND_HEIGHT_CLASS = "h-[17.375rem]";

// One floating catalog card on the bottom rail.
// Two-step tap: the first tap on an unselected card just selects it (highlight +
// snap the rail/map onto it); tapping the already-selected card opens its detail.
// Save and Share are siblings of that tap target, so they never select or open.

export function RailCard({
  place,
  selected,
  onSelect,
  onOpen,
  saved,
  onSave,
  onShare,
}: {
  place: Place;
  selected: boolean;
  onSelect: () => void;
  onOpen: () => void;
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
}) {
  const photo = cardPhoto(place);
  const placeholder = placePlaceholder(place);
  // THE HOME TILE'S FACTS, THE HOME TILE'S SCALE (Pato, MESITA-2651: "the
  // preview must show the same preview information"), from the same module
  // (place-card.tsx): name (+ the Enriched mark); category · $$ · ★ rating
  // (reviews); hours.
  const facts = cardFacts(place);

  return (
    <div
      className={cn(
        "border-border bg-card/95 shadow-elev relative isolate w-full overflow-hidden rounded-2xl border backdrop-blur",
        RAIL_CARD_HEIGHT_CLASS,
        selected && "border-primary ring-primary/30 ring-2 ring-inset",
      )}
    >
      <button
        type="button"
        onClick={selected ? onOpen : onSelect}
        className="focus-visible:ring-primary absolute inset-0 flex items-stretch text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
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
              sizes="140px"
              className="border-0 object-cover outline-none"
            />
          ) : (
            // The Home tile's no-photo face: the light fill and the
            // category's emoji (MESITA-2664, MESITA-2667).
            <span
              className="text-muted-foreground absolute inset-0 flex items-center justify-center"
              data-placeholder={placeholder.kind}
              aria-hidden
            >
              {placeholder.kind === "emoji" ? (
                <span className="text-5xl leading-none select-none">
                  {placeholder.emoji}
                </span>
              ) : (
                <span className="font-display text-3xl font-bold tracking-tight">
                  {placeholder.text}
                </span>
              )}
            </span>
          )}
        </div>
        <div className="text-foreground flex min-w-0 flex-1 flex-col gap-0.5 px-3 pt-3">
          <p className="flex min-w-0 items-center gap-1 font-sans text-base leading-5 font-semibold tracking-tight">
            <span className="truncate">{place.name}</span>
            {isEnrichedPlace(place) ? <EnrichedBadge /> : null}
          </p>
          <KindRow facts={facts} />
          <HoursRow facts={facts} withDistance={false} />
        </div>
      </button>
      {/* Under the text column: its left edge is the photo (the inner
          height, 8.25rem) plus the column's 12px, so 9rem. */}
      <CardActions
        name={place.name}
        saved={saved}
        onSave={onSave}
        onShare={onShare}
        className="absolute right-3 bottom-3 left-36"
      />
    </div>
  );
}
