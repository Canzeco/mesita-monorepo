import type { ReactNode } from "react";
import {
  Clock,
  Heart,
  Navigation,
  Share2,
  Sparkles,
  Star,
} from "lucide-react";
import type { Place } from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import { formatPlacePriceLevelSymbols } from "@mesita/place-profile/lib/place-price";
import { cn, formatCompactCount, formatKm, formatRating } from "@/lib/utils";

// THE PREVIEW CARD'S ROWS AND BUTTONS, ONE SOURCE (MESITA-2668): the Home
// tile and the Search map card print the same facts the same way (Pato,
// MESITA-2651: "the preview must show the same preview information").
//
// ONE TYPE SCALE (MESITA-2645): Inter, 14px on a 20px line, every row full
// ink (MESITA-2665). MESITA-5041: the icons are ink too. Reserve and
// Discounts are the only color on a card.

function readableKind(place: Place): string | null {
  const raw = place.category_label ?? place.category;
  if (!raw || raw.trim().toLowerCase() === "undefined") return null;
  return raw;
}

export type CardFacts = {
  /** The category alone, and the $$ alone (green on the card, MESITA-2673). */
  kind: string | null;
  price: string | null;
  rating: string | null;
  reviews: string | null;
  /** true open, false closed, null unknown (no Open or Closed on the card). */
  open: boolean | null;
  distance: string | null;
};

export function cardFacts(place: Place): CardFacts {
  // The same real-data mapper the detail Overview reads (MESITA-2371): stars,
  // review count, price, open state — a missing cell hides.
  const o = enrichPlaceOverview(place);
  // PRICE FOR DUMMIES (Pato, MESITA-2645: "price must be price range for
  // dummies ($, $$, $$$, $$$$)"): never "MX$200–300" on a card. The place
  // screen keeps the range.
  const price = formatPlacePriceLevelSymbols(place.price_level);
  return {
    kind: readableKind(place),
    price: price || null,
    rating: formatRating(o.google_rating),
    reviews:
      typeof o.google_count === "number" && o.google_count > 0
        ? formatCompactCount(o.google_count)
        : null,
    open: o.open_now ?? null,
    distance:
      typeof place.distance_km === "number" && place.distance_km > 0
        ? formatKm(place.distance_km)
        : null,
  };
}

const ROW = "flex min-w-0 items-center gap-1 font-sans text-sm leading-5";
const MARK = "h-3.5 w-3.5 shrink-0";

function Dot() {
  return (
    <span aria-hidden className="shrink-0">
      ·
    </span>
  );
}

/** $$ · category · ★ rating (reviews), the price first (MESITA-2674). Ink
 *  only (MESITA-5041). */
export function KindRow({ facts }: { facts: CardFacts }) {
  if (!facts.kind && !facts.price && !facts.rating) return null;
  return (
    <p className={ROW}>
      {facts.price ? (
        <span className="shrink-0">
          {facts.price}
        </span>
      ) : null}
      {facts.kind && facts.price ? <Dot /> : null}
      {facts.kind ? <span className="truncate">{facts.kind}</span> : null}
      {(facts.kind || facts.price) && facts.rating ? <Dot /> : null}
      {facts.rating ? (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Star
            className={cn(MARK, "fill-foreground")}
            aria-hidden
          />
          {facts.rating}
          {facts.reviews ? <span>({facts.reviews})</span> : null}
        </span>
      ) : null}
    </p>
  );
}

/** The clock and Open or Closed, then the distance. Ink only (MESITA-5041). */
export function HoursRow({ facts }: { facts: CardFacts }) {
  if (facts.open === null && !facts.distance) return null;
  return (
    <p className={ROW}>
      {facts.open !== null ? (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Clock
            className={MARK}
            strokeWidth={2}
            aria-hidden
          />
          {facts.open ? "Open" : "Closed"}
        </span>
      ) : null}
      {facts.open !== null && facts.distance ? <Dot /> : null}
      {facts.distance ? (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Navigation
            className={cn(MARK, "fill-foreground")}
            aria-hidden
          />
          {facts.distance}
        </span>
      ) : null}
    </p>
  );
}

/** Search card row two (MESITA-2674): $$ · category, in ink. */
export function PriceKindRow({ facts }: { facts: CardFacts }) {
  if (!facts.kind && !facts.price) return null;
  return (
    <p className={ROW}>
      {facts.price ? (
        <span className="shrink-0">
          {facts.price}
        </span>
      ) : null}
      {facts.kind && facts.price ? <Dot /> : null}
      {facts.kind ? <span className="truncate">{facts.kind}</span> : null}
    </p>
  );
}

/** Search card row three (MESITA-2859): ★ rating (reviews), then Open or
 *  Closed, no hours. With `withDistance` (Me › Favorites), the kilometres.
 *  Ink only (MESITA-5041). */
export function StarsOpenRow({
  facts,
  withDistance = false,
}: {
  facts: CardFacts;
  withDistance?: boolean;
}) {
  const distance = withDistance ? facts.distance : null;
  if (!facts.rating && facts.open === null && !distance) return null;
  return (
    <p className={ROW}>
      {facts.rating ? (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Star
            className={cn(MARK, "fill-foreground")}
            aria-hidden
          />
          {facts.rating}
          {facts.reviews ? <span>({facts.reviews})</span> : null}
        </span>
      ) : null}
      {facts.rating && facts.open !== null ? <Dot /> : null}
      {facts.open !== null ? (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Clock
            className={MARK}
            strokeWidth={2}
            aria-hidden
          />
          {facts.open ? "Open" : "Closed"}
        </span>
      ) : null}
      {(facts.rating || facts.open !== null) && distance ? <Dot /> : null}
      {distance ? (
        <span className="inline-flex min-w-0 items-center gap-1">
          <Navigation
            className={cn(MARK, "fill-foreground")}
            aria-hidden
          />
          <span className="truncate">{distance}</span>
        </span>
      ) : null}
    </p>
  );
}

/** Save · Share side by side, 8px apart. CardActions and the cards'
 *  loading silhouettes read this one string (MESITA-2701). */
export const CARD_ACTIONS_ROW = "grid grid-cols-2 gap-2";

/** A card button's box: 32px tall to the eye (MESITA-2652, MESITA-2661),
 *  rounded-lg. The buttons and their loading blocks read this one string
 *  (MESITA-2701). */
export const CARD_BUTTON_BOX = "h-8 rounded-lg";

// The place screen's action tile, on one line (MESITA-2650): the border grey
// at 60% (MESITA-2647), CARD_BUTTON_BOX, 12px semibold ink; an invisible 6px
// extension above and below keeps the 44px touch floor.
/** A button that catches only its drawn box (Pato, MESITA-3706: "all the
 *  white section must be clickable … between the buttons and the text above
 *  its fucked"): no invisible 6px hit extension, and it takes taps although
 *  its row lets them through to the tile's link. Home's tile only. */
export const EXACT_HIT = "pointer-events-auto after:hidden";

const CARD_BUTTON = `${CARD_BUTTON_BOX} bg-border/60 text-foreground hover:bg-border/80 relative flex after:absolute after:inset-x-0 after:-inset-y-1.5 min-w-0 items-center justify-center gap-1.5 px-2 font-sans text-sm font-normal transition active:scale-[0.99]`;

/**
 * SAVE AND SHARE, side by side (MESITA-2650). The word is Save, the mark the
 * heart (Pato, MESITA-2668: "instead of like use Save as word but keep the
 * heart"); saved, it reads Saved over a black heart (MESITA-5041: Reserve
 * and Discounts are the card's only color). Siblings of the card's
 * own link or button, so a tap never navigates. The parent places the row
 * 12px from the card's sides and bottom, the same as its text column
 * (MESITA-2668: "its not the same vertical margin as horizontal margin").
 *
 * GENERATE PROFILE ON A GOOGLE-ONLY CARD (Pato, MESITA-2843: "instead of save
 * and share, just generate profile"): with `onGenerate`, one full-width
 * button replaces the pair; the tap is the card's own explicit open, so the
 * opening screen does the one create (MESITA-2298).
 */
export function CardActions({
  name,
  saved,
  onSave,
  onShare,
  onGenerate,
  third,
  className,
  buttonClassName,
}: {
  name: string;
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  onGenerate?: () => void;
  /** A third cell after Share, the row then in thirds: Home's Premier
   *  (MESITA-5058, Pato: "Save Share (Premier) only if premier"). */
  third?: ReactNode;
  className?: string;
  /** Added to each button: Home's tile passes EXACT_HIT (MESITA-3706). */
  buttonClassName?: string;
}) {
  if (onGenerate) {
    return (
      <div className={cn(CARD_ACTIONS_ROW, className)} data-tile-actions>
        <button
          type="button"
          onClick={onGenerate}
          aria-label={`Generate ${name}'s profile`}
          className={cn(CARD_BUTTON, "col-span-2", buttonClassName)}
          data-tile-generate
        >
          <Sparkles
            className="h-3.5 w-3.5 shrink-0"
            strokeWidth={2}
            aria-hidden
          />
          Generate Profile
        </button>
      </div>
    );
  }
  return (
    <div
      className={cn(CARD_ACTIONS_ROW, third && "grid-cols-3", className)}
      data-tile-actions
    >
      <button
        type="button"
        onClick={onSave}
        aria-label={
          saved ? `Remove ${name} from favorites` : `Add ${name} to favorites`
        }
        className={cn(CARD_BUTTON, buttonClassName)}
        data-tile-save
      >
        <Heart
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            saved && "fill-foreground",
          )}
          strokeWidth={2}
          aria-hidden
        />
        {saved ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        onClick={onShare}
        aria-label={`Share ${name}`}
        className={cn(CARD_BUTTON, buttonClassName)}
        data-tile-share
      >
        <Share2 className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
        Share
      </button>
      {third}
    </div>
  );
}
