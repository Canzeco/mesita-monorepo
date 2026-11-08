import {
  BadgePercent,
  Clock,
  Heart,
  Navigation,
  Share2,
  Sparkles,
  Star,
} from "lucide-react";
import Link from "next/link";
import type { Place } from "@/lib/api/places";
import { enrichPlaceOverview } from "@/lib/adapters/enrich-overview";
import { formatPlacePriceLevelSymbols } from "@mesita/place-profile/lib/place-price";
import { cn, formatCompactCount, formatKm, formatRating } from "@/lib/utils";

// THE PREVIEW CARD'S ROWS AND BUTTONS, ONE SOURCE (MESITA-2668): the Home
// tile and the Search map card print the same facts the same way (Pato,
// MESITA-2651: "the preview must show the same preview information").
//
// ONE TYPE SCALE (MESITA-2645): Inter, 14px on a 20px line, every row full
// ink (MESITA-2665: "that is too light, I cannot read"). THE ICON CARRIES
// THE COLOUR, the words stay ink (MESITA-2668, Pato: "for hour use a clock,
// green if open, red if closed, for distance use blue … for stars yellow").

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

/** Home card row two: $$ · category · ★ rating (reviews), the price first
 *  (Pato, MESITA-2674: "price before category, it's easier and faster to see"),
 *  green; the star yellow. */
export function KindRow({ facts }: { facts: CardFacts }) {
  if (!facts.kind && !facts.price && !facts.rating) return null;
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
      {(facts.kind || facts.price) && facts.rating ? <Dot /> : null}
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

/** Home card row three: the clock, green Open or red Closed, never until when
 *  (Pato, MESITA-3229: "just open or closed, to save space"); then the blue
 *  arrow and the distance. */
export function HoursRow({ facts }: { facts: CardFacts }) {
  if (facts.open === null && !facts.distance) return null;
  return (
    <p className={ROW}>
      {facts.open !== null ? (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Clock
            className={cn(
              MARK,
              facts.open ? "text-fact-open" : "text-fact-closed",
            )}
            strokeWidth={2.5}
            aria-hidden
          />
          {facts.open ? "Open" : "Closed"}
        </span>
      ) : null}
      {facts.open !== null && facts.distance ? <Dot /> : null}
      {facts.distance ? (
        <span className="inline-flex shrink-0 items-center gap-1">
          <Navigation
            className={cn(MARK, "fill-fact-distance text-fact-distance")}
            aria-hidden
          />
          {facts.distance}
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

/** Search card row three (Pato, MESITA-2859: "stars, open/close thats it
 *  don't mention the hour"): ★ rating (reviews), the star yellow; then the
 *  clock, green Open or red Closed, no hours; then, when `withDistance` (Me ›
 *  Favorites), the blue arrow and the distance. */
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
            className={cn(MARK, "fill-fact-star text-fact-star")}
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
            className={cn(
              MARK,
              facts.open ? "text-fact-open" : "text-fact-closed",
            )}
            strokeWidth={2.5}
            aria-hidden
          />
          {facts.open ? "Open" : "Closed"}
        </span>
      ) : null}
      {(facts.rating || facts.open !== null) && distance ? <Dot /> : null}
      {distance ? (
        <span className="inline-flex min-w-0 items-center gap-1">
          <Navigation
            className={cn(MARK, "fill-fact-distance text-fact-distance")}
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
const CARD_BUTTON = `${CARD_BUTTON_BOX} bg-border/60 text-foreground hover:bg-border/80 relative flex after:absolute after:inset-x-0 after:-inset-y-1.5 min-w-0 items-center justify-center gap-1.5 px-2 font-sans text-xs font-semibold transition active:scale-[0.99]`;

/**
 * SAVE AND SHARE, side by side (MESITA-2650). The word is Save, the mark the
 * heart (Pato, MESITA-2668: "instead of like use Save as word but keep the
 * heart"); saved, it reads Saved over a red heart. Siblings of the card's
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
  className,
}: {
  name: string;
  saved: boolean;
  onSave: () => void;
  onShare: () => void;
  onGenerate?: () => void;
  className?: string;
}) {
  if (onGenerate) {
    return (
      <div className={cn(CARD_ACTIONS_ROW, className)} data-tile-actions>
        <button
          type="button"
          onClick={onGenerate}
          aria-label={`Generate ${name}'s profile`}
          className={cn(CARD_BUTTON, "col-span-2")}
          data-tile-generate
        >
          <Sparkles
            className="h-4 w-4 shrink-0"
            strokeWidth={2.25}
            aria-hidden
          />
          Generate Profile
        </button>
      </div>
    );
  }
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

/**
 * THE VOUCHER LINE under Save and Share, as wide as the two and as tall
 * (Pato, MESITA-3312: "if the place offers voucher, draw the kinda discount
 * voucher icon at the bottom of the buttons saying Up to 25% OFF"). The spot
 * and the form are MESITA-3233's coupon, which left with the discount
 * product (MESITA-3299): dark green on pale green, one line, 32px, the ticket
 * mark. The words are Pato's, fixed: "Up to 25% OFF" (MESITA-3313, his call
 * after the flag that vouchers are bonuses, +10% · +20% · +30%, and none is
 * 25% off; MESITA-3312 shipped "Up to 30% extra credit" for one evening).
 * The server's `vouchers_up_to_pct`, the best bonus among what the place
 * sells now, decides only whether the line shows; nothing for sale, no line.
 * Display only: a tap falls through to the card's own link beneath it.
 */
/** THE BONUS BUTTON (Pato, MESITA-3439: "add the button to Bonus, below save
 *  and share, wide button, just saying bonus x% don't mention prepay ... keep
 *  the sexy green button"): the place screen's Link green, full width, "30%
 *  Bonus" (its Prepay figure). It opens the place with its Rewards sheet up
 *  at Pre-Payment Rewards. */
export const BONUS_PCT = 30;
export function BonusButton({ href, name, className }: { href: string; name: string; className?: string }) {
  return (
    <Link
      href={`${href}?rewards=prepayment`}
      aria-label={`Welcome Bonus, ${BONUS_PCT}%, at ${name}`}
      className={cn(
        CARD_BUTTON_BOX,
        // The words at Save and Share's size, 12px semibold (Pato, MESITA-3442:
        // "make the letters same size"), and their 44px hit area.
        "relative flex w-full items-center justify-center bg-green-400 px-2.5 font-sans text-xs font-semibold text-neutral-950 transition after:absolute after:inset-x-0 after:-inset-y-1.5 hover:opacity-90 active:scale-[0.99]",
        className,
      )}
      data-tile-bonus
    >
      <BonusWords />
    </Link>
  );
}

/** WELCOME BONUS (Pato, MESITA-3444, A of four: "mention money too in offer,
 *  like Welcome bonus, 30% ... mention % icon"): the % glyph, "Welcome Bonus",
 *  the 30% in the ink pill Prepay wears. The Welcome voucher is MX$100 for
 *  MX$130, one per guest on a first visit. */
function BonusWords() {
  return (
    <span className="flex items-center gap-1.5">
      <BadgePercent className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
      Welcome Bonus
      <span className="bg-foreground text-paper rounded-md px-1.5 py-0.5 text-xs leading-none font-bold tabular-nums">
        {BONUS_PCT}%
      </span>
    </span>
  );
}

/** The Search map card's top strip (MESITA-3444): the Bonus words on Link
 *  green, part of the card (its tap opens the place). It was "Up to 25% OFF"
 *  on the server's voucher number (MESITA-3327). */
export function BonusStrip({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        CARD_BUTTON_BOX,
        "pointer-events-none flex w-full items-center justify-center bg-green-400 px-2.5 font-sans text-xs font-semibold text-neutral-950",
        className,
      )}
      data-tile-bonus
    >
      <BonusWords />
    </p>
  );
}

