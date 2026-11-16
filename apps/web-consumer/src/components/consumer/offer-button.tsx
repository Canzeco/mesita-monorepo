"use client";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { useState } from "react";
import { OfferTrack, offerSlides as slidesFor, offersLabel, useOfferSlide, type OfferSlide } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { cn } from "@/lib/utils";
import { CARD_BUTTON_BOX } from "@/components/consumer/place-card";

// THE SLIDES, THE BEAT AND THE TRACK LIVE IN packages/place-profile
// (offer-slides.tsx, MESITA-4151): the place screen's Offers tile reads the
// same ones, so Home, Search and the place never say different offers.
export type { OfferSlide };

/** The place's slides from its list row (MESITA-3467); none = no button. */
export function offerSlides(place: Pick<Place, "offers">): OfferSlide[] {
  return slidesFor(place.offers);
}

const OFFER_BOX =
  "relative flex w-full items-center justify-center px-2.5 font-sans text-xs font-semibold transition-colors duration-300";

/** THE OFFER BUTTON (MESITA-3439's green Bonus button, rotating since
 *  MESITA-3467): full width under Save and Share, the place screen's Link
 *  green, 12px semibold as Save and Share (MESITA-3442), a 44px hit area.
 *  The slide on screen when the finger lands picks the Offers section, and
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
      // directly"). PAY OPENS THE PLAIN PROFILE (Pato, 2026-11-15, MESITA-4062:
      // "remove payments from the prepayments page"): the Offers sheet has no
      // cashback card now, and the Pay tile there shows the rate. It is where
      // tapping the card goes too; Pato can flip it to /pay from the preview.
      href={slide.section ? `${href}?rewards=${slide.section}` : href}
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
