import { Clock, Heart, Navigation, Share2, Star } from "lucide-react";
import type { Place } from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import { formatPlacePriceLevelSymbols } from "@/lib/place-price";
import { cn, formatCompactCount, formatKm, formatRating } from "@/lib/utils";

// THE PREVIEW CARD'S ROWS AND BUTTONS, ONE SOURCE (MESITA-2668): the Home
// tile and the Search map card print the same facts the same way (Pato,
// MESITA-2651: "the preview must show the same preview information").
//
// ONE TYPE SCALE (MESITA-2645): Inter, 14px on a 20px line, every row full
// ink (MESITA-2665: "that is too light, I cannot read"). THE ICON CARRIES
// THE COLOUR, the words stay ink (MESITA-2668, Pato: "for hour use a clock,
// green if open, red if closed, for distance use blue … for stars yellow").

/** Capitalise every word ("opens tomorrow 07:00" → "Opens Tomorrow 07:00"). */
function titleWords(line: string): string {
  return line.replace(/(^|\s)(\p{Ll})/gu, (_, sp, ch) => sp + ch.toUpperCase());
}

function readableKind(place: Place): string | null {
  const raw = place.category_label ?? place.category;
  if (!raw || raw.trim().toLowerCase() === "undefined") return null;
  return raw;
}

export type CardFacts = {
  /** "Cafe · $$": category, then the price level as dollar signs. */
  kindPrice: string;
  /** The category alone, and the $$ alone (green on the card, MESITA-2673). */
  kind: string | null;
  price: string | null;
  rating: string | null;
  reviews: string | null;
  /** true open, false closed, null unknown (no hours row). */
  open: boolean | null;
  /** "Closed · Opens Tomorrow 07:00", Title Case (MESITA-2665). */
  hours: string | null;
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
  const hours =
    o.open_now === true
      ? o.closes_at
        ? `Open · until ${o.closes_at}`
        : "Open now"
      : o.open_now === false
        ? o.opens_at
          ? `Closed · opens ${o.opens_at}`
          : "Closed"
        : null;
  return {
    kindPrice: [readableKind(place), price].filter(Boolean).join(" · "),
    kind: readableKind(place),
    price: price || null,
    rating: formatRating(o.google_rating),
    reviews:
      typeof o.google_count === "number" && o.google_count > 0
        ? formatCompactCount(o.google_count)
        : null,
    open: hours ? o.open_now === true : null,
    hours: hours ? titleWords(hours) : null,
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

/** Row two: $$ · category · ★ rating (reviews) — the price first (Pato,
 *  MESITA-2674: "price before category, it's easier and faster to see"),
 *  green; the star yellow. */
export function KindRow({ facts }: { facts: CardFacts }) {
  if (!facts.kindPrice && !facts.rating) return null;
  return (
    <p className={ROW}>
      {facts.price ? (
        // The price in green (Pato, MESITA-2673: "price tag green").
        <span className="text-fact-price shrink-0 font-semibold">
          {facts.price}
        </span>
      ) : null}
      {facts.kind && facts.price ? <Dot /> : null}
      {facts.kind ? <span className="truncate">{facts.kind}</span> : null}
      {facts.kindPrice && facts.rating ? <Dot /> : null}
      {facts.rating ? (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Star
            className={cn(MARK, "fill-fact-star text-fact-star")}
            aria-hidden
          />
          {facts.rating}
          {facts.reviews ? <span>({facts.reviews})</span> : null}
        </span>
      ) : null}
    </p>
  );
}

/** Search card row two (MESITA-2674): $$ (green) · category. */
export function PriceKindRow({ facts }: { facts: CardFacts }) {
  if (!facts.kind && !facts.price) return null;
  return (
    <p className={ROW}>
      {facts.price ? (
        <span className="text-fact-price shrink-0 font-semibold">
          {facts.price}
        </span>
      ) : null}
      {facts.kind && facts.price ? <Dot /> : null}
      {facts.kind ? <span className="truncate">{facts.kind}</span> : null}
    </p>
  );
}

/** Search card row three (MESITA-2674): ★ rating (reviews), the star yellow. */
export function StarsRow({ facts }: { facts: CardFacts }) {
  if (!facts.rating) return null;
  return (
    <p className={ROW}>
      <Star className={cn(MARK, "fill-fact-star text-fact-star")} aria-hidden />
      {facts.rating}
      {facts.reviews ? <span>({facts.reviews})</span> : null}
    </p>
  );
}

/**
 * Row three: a clock, green open and red closed, then the hours; then, when
 * `withDistance`, a blue arrow and the distance. The Search card leaves the
 * distance out: the map already says where the place is (MESITA-2668).
 */
export function HoursRow({
  facts,
  withDistance = true,
}: {
  facts: CardFacts;
  withDistance?: boolean;
}) {
  const distance = withDistance ? facts.distance : null;
  if (!facts.hours && !distance) return null;
  return (
    <p className={ROW}>
      {facts.hours ? (
        <>
          <Clock
            className={cn(
              MARK,
              facts.open ? "text-fact-open" : "text-fact-closed",
            )}
            strokeWidth={2.5}
            aria-hidden
          />
          <span className="truncate">{facts.hours}</span>
        </>
      ) : null}
      {facts.hours && distance ? <Dot /> : null}
      {distance ? (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Navigation
            className={cn(MARK, "fill-fact-distance text-fact-distance")}
            aria-hidden
          />
          {distance}
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
const CARD_BUTTON = `${CARD_BUTTON_BOX} bg-border/60 text-foreground hover:bg-border/80 relative flex after:absolute after:inset-x-0 after:-inset-y-1.5 min-w-0 items-center justify-center gap-1.5 px-2 font-sans text-xs font-semibold transition active:scale-[0.99]`;

/**
 * SAVE AND SHARE, side by side (MESITA-2650). The word is Save, the mark the
 * heart (Pato, MESITA-2668: "instead of like use Save as word but keep the
 * heart"); saved, it reads Saved over a red heart. Siblings of the card's
 * own link or button, so a tap never navigates. The parent places the row
 * 12px from the card's sides and bottom, the same as its text column
 * (MESITA-2668: "its not the same vertical margin as horizontal margin").
 */
export function CardActions({
  name,
  saved,
  onSave,
  onShare,
  className,
}: {
  name: string;
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  className?: string;
}) {
  return (
    <div className={cn(CARD_ACTIONS_ROW, className)} data-tile-actions>
      <button
        type="button"
        onClick={onSave}
        aria-label={
          saved ? `Remove ${name} from favorites` : `Add ${name} to favorites`
        }
        className={CARD_BUTTON}
        data-tile-save
      >
        <Heart
          className={cn(
            "h-4 w-4 shrink-0",
            saved && "fill-destructive text-destructive",
          )}
          strokeWidth={2.25}
          aria-hidden
        />
        {saved ? "Saved" : "Save"}
      </button>
      <button
        type="button"
        onClick={onShare}
        aria-label={`Share ${name}`}
        className={CARD_BUTTON}
        data-tile-share
      >
        <Share2 className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
        Share
      </button>
    </div>
  );
}
