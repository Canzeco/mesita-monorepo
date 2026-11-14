"use client";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { useState } from "react";
import type { Place } from "@/lib/api/places";
import { cn } from "@/lib/utils";
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
  /** The short word before the pill on Places 3.0's narrow card
   *  (MESITA-3671, back in MESITA-3762). */
  short: string;
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

// FIVE WORDS, IN PATO'S ORDER (MESITA-3791: "in the offers banners just
// show this: Welcome (+X%) · Story (+X%) · VIP (+X%) · Pay (+X% Back) ·
// Prepay (+X%) ONLY SHOW THE HIGHEST STANDARD VOUCHER"): the three special
// vouchers, then the card cashback as Pay, then ONE Prepay slide for the
// best of the $200 / $1,000 / $5,000 vouchers on sale. Cash (MESITA-3671)
// and the three sized slides are gone from the banner. Every banner (the
// Places rows, Search's strip) reads the same words; `short` = `lead`.
const OFFER_SLIDES: OfferSlide[] = [
  { key: "voucher_welcome", lead: "Welcome", pill: "+50%", short: "Welcome", spoken: "Welcome prepay, 50% bonus", section: "special", tone: "bg-[#2563EB] text-white", bonus: 50 },
  { key: "voucher_story", lead: "Story", pill: "+30%", short: "Story", spoken: "Story prepay, 30% bonus", section: "special", tone: "bg-[#E1306C] text-white", bonus: 30 },
  { key: "voucher_vip", lead: "VIP", pill: "+50%", short: "VIP", spoken: "VIP prepay, 50% bonus", section: "special", tone: "bg-[#F5B301] text-neutral-950", bonus: 50 },
  // The pill is filled in from the place's own card rate (offerSlides).
  { key: "cashback", lead: "Pay", pill: "Back", short: "Pay", spoken: "Mesita Pay cashback", section: "payment", tone: GREEN },
  // The best standard voucher on sale (offerSlides picks it).
  { key: "prepay", lead: "Prepay", pill: "", short: "Prepay", spoken: "Prepay", section: "prepayment", tone: GREEN },
];

/** The standard vouchers' bonuses (vouchers.tsx STANDARD): the Prepay
 *  slide shows the highest one the place sells. */
const STANDARD_BONUS: Record<string, number> = {
  voucher_200: 10,
  voucher_1000: 20,
  voucher_5000: 30,
};

/** The place's slides, in the fixed order; none = no button. */
export function offerSlides(place: Pick<Place, "offers">): OfferSlide[] {
  const offers = place.offers;
  if (!offers) return [];
  const sell = new Set(offers.sell);
  // The Pay slide says the place's own card rate (MESITA-3589); an older
  // answer without it shows no slide rather than a guessed number.
  const bps = offers.card_cashback_bps ?? 0;
  const best = Math.max(
    0,
    ...Object.entries(STANDARD_BONUS)
      .filter(([key]) => sell.has(key))
      .map(([, bonus]) => bonus),
  );
  return OFFER_SLIDES.flatMap((s): OfferSlide[] => {
    if (s.key === "cashback")
      return offers.cashback && bps > 0
        ? [{ ...s, pill: `+${bps / 100}% Back`, spoken: `Mesita Pay, ${bps / 100}% back` }]
        : [];
    if (s.key === "prepay")
      return best > 0
        ? [{ ...s, pill: `+${best}%`, spoken: `Prepay, ${best}% bonus`, bonus: best }]
        : [];
    return sell.has(s.key) ? [s] : [];
  });
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

const OFFER_PILL =
  "bg-foreground text-paper shrink-0 rounded-md px-1.5 py-0.5 text-xs leading-none font-bold tabular-nums";

/** A slide's SHORT words (Pato, MESITA-3671): its short word, then the
 *  black pill: a voucher's bonus alone ("Story [+30%]"), cashback's rate as
 *  "5% Back" (MESITA-3678: "better the short form of cashback"). */
function shortWords(slide: OfferSlide): { lead: string; pill: string } {
  // One set of words since MESITA-3791: the short ones are the long ones.
  return { lead: slide.short, pill: slide.pill };
}

/** The words on the box: the slide's lead, then the ink pill; with `short`,
 *  the short ones (Places 3.0). */
function OfferWords({ slide, short = false, className }: { slide: OfferSlide; short?: boolean; className?: string }) {
  const words = short ? shortWords(slide) : slide;
  return (
    <span className={cn("absolute inset-0 flex items-center justify-center gap-1.5", className)}>
      <span className="truncate">{words.lead}</span>
      <span className={OFFER_PILL}>{words.pill}</span>
    </span>
  );
}

/** The moving words inside the still green box, hidden from screen readers
 *  (the box's label lists every offer once). Keyed by slide so each change
 *  replays the slide-up. */
function OfferTrack({ slides, index, previous, short }: { slides: OfferSlide[]; index: number; previous: number | null; short?: boolean }) {
  return (
    <span className="relative block h-full w-full overflow-hidden" aria-hidden>
      {previous !== null ? <OfferWords key={`out-${slides[previous].key}-${index}`} slide={slides[previous]} short={short} className="offer-out" /> : null}
      <OfferWords key={`in-${slides[index].key}`} slide={slides[index]} short={short} className={previous !== null ? "offer-in" : undefined} />
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
  short = false,
  className,
}: {
  href: string;
  name: string;
  slides: OfferSlide[];
  /** The short words: Places 3.0 (MESITA-3671). */
  short?: boolean;
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
    <PushLink
      // EVERY SLIDE OPENS THE PROFILE WITH ITS OFFERS (Pato, MESITA-3797:
      // "if i click the offer, that opens profile and then offers too
      // directly"): Pay too, at its Payment section; it went to /pay before.
      href={`${href}?rewards=${slide.section}`}
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
      <OfferTrack slides={slides} index={index} previous={held === null ? live.previous : null} short={short} />
    </PushLink>
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
