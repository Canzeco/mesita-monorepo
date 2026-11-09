"use client";

import Link from "next/link";
import { useState } from "react";
import type { Place } from "@/lib/api/places";
import { cn } from "@/lib/utils";
import { isGoogleOnlyPlace } from "@/lib/place-placeholder";
import { CARD_BUTTON_BOX } from "@/components/consumer/place-card";
import { useOfferBeat, useReducedMotion } from "@/components/consumer/offer-beat";

/** THE OFFER BUTTON'S SLIDES (MESITA-3467, Pato: "the green button must
 *  have multiple ... a carousel of offers: Pay (5% Back), Prepay $100 (10%
 *  Bonus) ... whatever offers the place is offering"). Only what the place
 *  offers now (the list row's `offers`: cashback and the vouchers on sale),
 *  in this order: Pay first (any guest, any visit), then the three sizes,
 *  Story, VIP, Welcome (MESITA-3475). The figures are the Rewards sheet's catalog
 *  (packages/place-profile vouchers.tsx STANDARD and SPECIAL); a change there
 *  changes here. Each slide opens the Rewards sheet at its own section. */
export type OfferSlide = {
  key: string;
  /** The words before the ink pill. */
  lead: string;
  pill: string;
  /** Read aloud in the button's label. */
  spoken: string;
  section: "payment" | "prepayment" | "special";
  /** The box's colour and ink while this slide shows (MESITA-3475). */
  tone: string;
  /** A voucher's bonus in percent; the list band reads the best one
   *  (MESITA-3380). Cashback has none. */
  bonus?: number;
};

// THE WORDS AND COLOURS ARE PATO'S (MESITA-3475: "Pay (5% Back) / Prepay
// $200 (10% Bonus) / ... / Story Prepay (30% Bonus) / VIP Prepay (30% Bonus) /
// Welcome Prepay (30% Bonus) ... green for all the offers but blue for welcome
// and pink for insta and yellow for vip"): the Offers page's voucher colours.
const GREEN = "bg-green-400 text-neutral-950";

const OFFER_SLIDES: OfferSlide[] = [
  { key: "cashback", lead: "Mesita Pay", pill: "+5% Cashback", spoken: "Mesita Pay, 5% cashback", section: "payment", tone: GREEN },
  // "$X Prepay", never "Prepay $X"; "Mesita Pay +5% Cashback" (MESITA-3508). $…MX: the currency after the amount (MESITA-3490, MESITA-3481).
  { key: "voucher_200", lead: "$200MX Prepay", pill: "+10% Bonus", spoken: "$200MX prepay, 10% bonus", section: "prepayment", tone: GREEN, bonus: 10 },
  { key: "voucher_1000", lead: "$1,000MX Prepay", pill: "+20% Bonus", spoken: "$1,000MX prepay, 20% bonus", section: "prepayment", tone: GREEN, bonus: 20 },
  { key: "voucher_5000", lead: "$5,000MX Prepay", pill: "+30% Bonus", spoken: "$5,000MX prepay, 30% bonus", section: "prepayment", tone: GREEN, bonus: 30 },
  { key: "voucher_story", lead: "Story Prepay", pill: "+30% Bonus", spoken: "Story prepay, 30% bonus", section: "special", tone: "bg-[#E1306C] text-white", bonus: 30 },
  { key: "voucher_vip", lead: "VIP Prepay", pill: "+30% Bonus", spoken: "VIP prepay, 30% bonus", section: "special", tone: "bg-[#F5B301] text-neutral-950", bonus: 30 },
  { key: "voucher_welcome", lead: "Welcome Prepay", pill: "+30% Bonus", spoken: "Welcome prepay, 30% bonus", section: "special", tone: "bg-[#2563EB] text-white", bonus: 30 },
];

/** The place's slides, in the fixed order; none = no button. */
export function offerSlides(place: Pick<Place, "offers">): OfferSlide[] {
  const offers = place.offers;
  if (!offers) return [];
  const sell = new Set(offers.sell);
  return OFFER_SLIDES.filter((s) => (s.key === "cashback" ? offers.cashback : sell.has(s.key)));
}

/** The best bonus the listed places' vouchers give, in percent, or null
 *  when none of them sells one (MESITA-3380). The same `offers.sell` the
 *  tiles' slides read; a Google-only place sells nothing. */
export function bestVoucherBonus(places: ReadonlyArray<Pick<Place, "offers" | "googleOnly" | "from_google">>): number | null {
  let best: number | null = null;
  for (const place of places) {
    if (isGoogleOnlyPlace(place)) continue;
    for (const slide of offerSlides(place)) {
      if (slide.bonus !== undefined && (best === null || slide.bonus > best)) best = slide.bonus;
    }
  }
  return best;
}

/** THE VOUCHER BAND (MESITA-3380): one line above Home's tiles and Search's
 *  cards naming what vouchers give, drawn only when a listed place sells
 *  one. It hides nothing: no place is filtered by it, and with no seller it
 *  is not drawn at all. Not a link (each place's own green button opens its
 *  vouchers). */
export function VoucherBand({
  places,
  className,
}: {
  places: ReadonlyArray<Pick<Place, "offers" | "googleOnly" | "from_google">>;
  className?: string;
}) {
  const bonus = bestVoucherBonus(places);
  if (bonus === null) return null;
  return (
    <p
      className={cn("px-2.5 py-1.5 text-center font-sans text-xs font-semibold", GREEN, className)}
      data-voucher-band
    >
      Up to{" "}
      <span className="bg-foreground text-paper rounded-md px-1.5 py-0.5 text-xs leading-none font-bold tabular-nums">
        +{bonus}% Bonus
      </span>{" "}
      at places that sell vouchers
    </p>
  );
}

function offersLabel(name: string, slides: OfferSlide[]): string {
  return `Offers at ${name}: ${slides.map((s) => s.spoken).join("; ")}`;
}

/** The slide the shared beat shows now, plus the one it just left (for the
 *  slide-up), or a still first slide under reduced motion. */
function useOfferSlide(slides: OfferSlide[]): { index: number; previous: number | null } {
  const beat = useOfferBeat();
  const reduced = useReducedMotion();
  // The beat this button first drew on: no slide-up on arrival.
  const [firstBeat] = useState(beat);
  const n = slides.length;
  if (n <= 1 || reduced) return { index: 0, previous: null };
  const index = beat % n;
  return { index, previous: beat === firstBeat ? null : (beat - 1 + n) % n };
}

function OfferWords({ slide, className }: { slide: OfferSlide; className?: string }) {
  return (
    <span className={cn("absolute inset-0 flex items-center justify-center gap-1.5", className)}>
      {slide.lead}
      <span className="bg-foreground text-paper rounded-md px-1.5 py-0.5 text-xs leading-none font-bold tabular-nums">
        {slide.pill}
      </span>
    </span>
  );
}

/** The moving words inside the still green box, hidden from screen readers
 *  (the box's label lists every offer once). Keyed by slide so each change
 *  replays the slide-up. */
function OfferTrack({ slides, index, previous }: { slides: OfferSlide[]; index: number; previous: number | null }) {
  return (
    <span className="relative block h-full w-full overflow-hidden" aria-hidden>
      {previous !== null ? <OfferWords key={`out-${slides[previous].key}-${index}`} slide={slides[previous]} className="offer-out" /> : null}
      <OfferWords key={`in-${slides[index].key}`} slide={slides[index]} className={previous !== null ? "offer-in" : undefined} />
    </span>
  );
}

const OFFER_BOX =
  "relative flex w-full items-center justify-center px-2.5 font-sans text-xs font-semibold transition-colors duration-300";

/** THE OFFER BUTTON (MESITA-3439's green Bonus button, rotating since
 *  MESITA-3467): full width under Save and Share, the place screen's Link
 *  green, 12px semibold as Save and Share (MESITA-3442), a 44px hit area.
 *  The slide on screen when the finger lands picks the Rewards section, and
 *  the button holds that slide while a finger or keyboard focus is on it. */
export function OfferButton({
  href,
  name,
  slides,
  className,
}: {
  href: string;
  name: string;
  slides: OfferSlide[];
  className?: string;
}) {
  const live = useOfferSlide(slides);
  const [held, setHeld] = useState<number | null>(null);
  if (slides.length === 0) return null;
  const index = held ?? live.index;
  const slide = slides[index];
  const hold = () => setHeld((h) => h ?? live.index);
  const release = () => setHeld(null);
  return (
    <Link
      href={slide.section === "payment" ? "/pay" : `${href}?rewards=${slide.section}`}
      aria-label={offersLabel(name, slides)}
      onPointerDown={hold}
      onFocus={hold}
      onPointerCancel={release}
      onPointerLeave={release}
      onBlur={release}
      className={cn(
        CARD_BUTTON_BOX,
        OFFER_BOX,
        slide.tone,
        "transition after:absolute after:inset-x-0 after:-inset-y-1.5 hover:opacity-90 active:scale-[0.99]",
        className,
      )}
      data-tile-bonus
    >
      <OfferTrack slides={slides} index={index} previous={held === null ? live.previous : null} />
    </Link>
  );
}

/** The Search map card's top strip (MESITA-3444): the same slides on the
 *  same beat (MESITA-3467), part of the card (its tap opens the place). */
export function OfferStrip({ name, slides, className }: { name: string; slides: OfferSlide[]; className?: string }) {
  const live = useOfferSlide(slides);
  if (slides.length === 0) return null;
  return (
    <p
      className={cn(CARD_BUTTON_BOX, OFFER_BOX, slides[live.index].tone, "pointer-events-none", className)}
      aria-label={offersLabel(name, slides)}
      data-tile-bonus
    >
      <OfferTrack slides={slides} index={live.index} previous={live.previous} />
    </p>
  );
}
