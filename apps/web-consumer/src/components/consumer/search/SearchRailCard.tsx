import type { ReactNode } from "react";
import { PremierBadge, SizedImage } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import {
  cardPhoto,
  isGoogleOnlyPlace,
  placePlaceholder,
} from "@/lib/place-placeholder";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/shared";
import {
  CARD_ACTIONS_ROW,
  CARD_BUTTON_BOX,
  CardActions,
  PriceKindRow,
  StarsOpenRow,
  cardFacts,
} from "@/components/consumer/place-card";

// FOUR ROWS, SHORTER (Pato, MESITA-2859: "name, select / price, category /
// stars, open/close thats it don't mention the hour / buttons — so now its
// four lines, not five — so the boxes are a bit shorter"): name (+ mark);
// $$ · category; ★ rating (reviews) · Open or Closed; Save and Share. 12px
// inside, the three text rows (64px), 12px, the buttons (32px), 12px: 134px
// with the border. The photo is the inner height, square.
//
// Was: FIVE ROWS, TALLER STILL (Pato, MESITA-2674: "name / price, category /
// stars / time / buttons, 5 rows"): name; $$ · category; ★ rating
// (reviews); hours; Save and Share. 156px with the border; the photo is the
// inner height, square, so the buttons start at its width + 12px.
//
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

/** The card's frame, its text column and where Save · Share sit: one set
 *  for RailCard and RailCardSkeleton, so the loading card cannot drift
 *  from the loaded one. */
export const RAIL_CARD_FRAME =
  "border-border bg-card/95 shadow-elev relative isolate w-full overflow-hidden rounded-2xl border backdrop-blur";
export const RAIL_CARD_TEXT = "flex min-w-0 flex-1 flex-col gap-0.5 px-3 pt-3";
/** Save · Share under the text column: the left edge is the square photo
 *  (the 132px inner height) plus the column's 12px. */
const RAIL_CARD_ACTIONS =
  "absolute right-3 bottom-3 left-[calc(8.375rem+10px)]";

/** One 20px text row of the card in loading: a bar at the line's type size
 *  (16px name, 14px facts), centred on the row's line box. */
function RailRowSkeleton({ bar }: { bar: string }) {
  return (
    <div className="flex h-5 items-center">
      <Skeleton className={bar} />
    </div>
  );
}

/** RailCard while the catalog loads (Pato, MESITA-2701: "the placeholders
 *  must be similar to the page you are loading, like the sizes"): the same
 *  frame, the square thumb at the inner height, the three 20px rows (name ·
 *  $$ category · ★ rating Open) and Save · Share where CardActions
 *  sits, so nothing moves when the cards land. */
export function RailCardSkeleton() {
  return (
    <div aria-hidden className={cn(RAIL_CARD_FRAME, RAIL_CARD_HEIGHT_CLASS)}>
      <div className="absolute inset-0 flex items-stretch">
        <Skeleton className="aspect-square h-full w-auto shrink-0 rounded-none" />
        <div className={RAIL_CARD_TEXT}>
          <RailRowSkeleton bar="h-4 w-3/4" />
          <RailRowSkeleton bar="h-3.5 w-1/2" />
          <RailRowSkeleton bar="h-3.5 w-3/5" />
        </div>
      </div>
      <div className={cn(CARD_ACTIONS_ROW, RAIL_CARD_ACTIONS)}>
        <Skeleton className={CARD_BUTTON_BOX} />
        <Skeleton className={CARD_BUTTON_BOX} />
      </div>
    </div>
  );
}

// One floating catalog card on the bottom rail.
// ONE TAP OPENS the card's detail (Pato, MESITA-2824: the old select-first
// tap read as "nothing opens"); the ring marks the pin the rail is on. Save
// and Share are siblings of that tap target, so they never open.
//
// ALSO ME › FAVORITES' ROW (Pato, MESITA-2698: "in favorites use this style
// … the horizontal style to save things"). There it has no map, and
// `withDistance` puts the distance back on row three.

export function RailCard({
  place,
  selected,
  onOpen,
  saved,
  onSave,
  onShare,
  withDistance = false,
  photoOverlay,
}: {
  place: Place;
  selected: boolean;
  onOpen: () => void;
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  withDistance?: boolean;
  /** Drawn over the photo, e.g. Search's score readout (MESITA-2877). */
  photoOverlay?: ReactNode;
}) {
  const photo = cardPhoto(place);
  const placeholder = placePlaceholder(place);
  // THE HOME TILE'S FACTS, THE HOME TILE'S SCALE (Pato, MESITA-2651: "the
  // preview must show the same preview information"), from the same module
  // (place-card.tsx): name (+ the Premier mark, rosette and level alone:
  // the text column is narrow, MESITA-2925); $$ · category; ★ rating
  // (reviews) · Open or Closed.
  const facts = cardFacts(place);

  return (
    <div
      className={cn(
        RAIL_CARD_FRAME,
        RAIL_CARD_HEIGHT_CLASS,
        selected && "border-primary ring-primary/30 ring-2 ring-inset",
      )}
    >
      <button
        type="button"
        // ONE TAP OPENS (Pato, MESITA-2824: a card that only selected read
        // as "nothing opens"). The select-then-open dance stays on the pins;
        // a card the guest taps is the deliberate open, Google-only included
        // (the opening screen creates, never this tap).
        onClick={onOpen}
        className="focus-visible:ring-primary absolute inset-0 flex items-stretch text-left outline-none focus-visible:ring-2 focus-visible:ring-inset"
      >
        {/* Square thumb, card stays a wide rectangle. Bleeds to the card edge
            — clip only, no inner radius or stroke. Height is the locked card
            height; width matches so the box is always 1:1. */}
        <div className="bg-muted relative aspect-square h-full w-auto shrink-0 overflow-hidden">
          {photo ? (
            <SizedImage
              src={photo}
              size="card"
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
          {photoOverlay}
        </div>
        <div className={cn("text-foreground", RAIL_CARD_TEXT)}>
          <p className="flex min-w-0 items-center gap-1 font-sans text-base leading-5 font-semibold tracking-tight">
            <span className="truncate">{place.name}</span>
            <PremierBadge tier={place.boost_tier} compact ad />
          </p>
          <PriceKindRow facts={facts} />
          <StarsOpenRow facts={facts} withDistance={withDistance} />
        </div>
      </button>
      {/* Under the text column (RAIL_CARD_ACTIONS). */}
      <CardActions
        name={place.name}
        saved={saved}
        onSave={onSave}
        onShare={onShare}
        // A Google-only card generates its profile instead (MESITA-2843).
        onGenerate={isGoogleOnlyPlace(place) ? onOpen : undefined}
        className={RAIL_CARD_ACTIONS}
      />
    </div>
  );
}
