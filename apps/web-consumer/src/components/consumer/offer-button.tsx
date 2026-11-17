"use client";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { OfferTrack, offerChips as chipsFor, offerSlides as slidesFor, offersLabel, useOfferSlide, type OfferChip, type OfferSlide } from "@mesita/place-profile";
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

/** The place's chips from its list row (MESITA-4207); none = no block. */
export function offerChips(place: Pick<Place, "offers">): OfferChip[] {
  return chipsFor(place.offers);
}

/** EVERY OFFER AS A CHIP (Pato, 2026-11-16, MESITA-4207 design review: "the
 *  preliminar offers in the home view look like shit"): one chip per voucher
 *  this guest can buy here, "Welcome +100%" · "Story +50%" · "Small +10%" ·
 *  "Medium +20%" · "Big +30%", wrapping, nothing moving. Each is the Offers
 *  page's chip (32px, its colour per kind, black ink) and its own link: it
 *  opens the place's Offers with that voucher ticked (`?voucher=`). 44px to
 *  tap: an invisible 6px above and below. The rotating OfferButton
 *  (MESITA-3439, MESITA-3467) before. */
export function OfferChips({ href, name, chips, className }: {
  href: string;
  name: string;
  chips: OfferChip[];
  className?: string;
}) {
  if (chips.length === 0) return null;
  return (
    <ul className={cn("flex flex-wrap gap-x-1.5 gap-y-3", className)} aria-label={`Offers at ${name}`} data-offer-chips>
      {chips.map((c) => (
        <li key={c.key}>
          <PushLink
            href={`${href}?rewards=${c.section}&voucher=${c.key}`}
            aria-label={`${c.spoken}, at ${name}`}
            className={cn(
              "pointer-events-auto relative inline-flex h-8 items-center rounded-lg px-2 text-xs font-extrabold tracking-tight whitespace-nowrap tabular-nums",
              "focus-visible:ring-primary outline-none focus-visible:ring-2",
              "transition after:absolute after:inset-x-0 after:-inset-y-1.5 hover:opacity-90 active:scale-[0.98]",
              c.tone,
            )}
            data-offer-chip={c.key}
          >
            {c.label}
          </PushLink>
        </li>
      ))}
    </ul>
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
