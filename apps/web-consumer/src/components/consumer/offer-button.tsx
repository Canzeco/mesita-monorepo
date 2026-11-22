"use client";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { useState } from "react";

import { OfferTrack, offerSlides as slidesFor, offersLabel, useOfferSlide, type OfferSlide } from "@mesita/place-profile";
import type { Place } from "@/lib/api/places";
import { trackEvent } from "@/lib/analytics/track";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
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

/** ONE SWITCHING BOX (Pato, 2026-11-17, MESITA-4219: "this boxes looks like
 *  shit, return to the switching boxes"): every offer this guest can buy here
 *  in one box the height of Save · Share, Classic · Story, each
 *  in its colour with its "N% Bonus" pill, on the shared 2s beat. A TAP OPENS
 *  THE PLACE (Pato, 2026-11-19, MESITA-4455: "don't redirect directly to the
 *  offers page. direct to the place profile, and then i need to click
 *  offers"); Offers is the profile's own tile. Before that a tap opened
 *  the place's Offers page, never one offer's sheet (MESITA-4358, Pato: "just
 *  redirect to the offers, wherever I click it"; `?voucher=` before). Held only
 *  while a finger is down (MESITA-4217). MESITA-4207's chip list before. */
export function OfferButton({
  href,
  name,
  slides,
  placeId,
  className,
}: {
  href: string;
  name: string;
  slides: OfferSlide[];
  /** The place id, so a tap can say which voucher was showing (MESITA-4209). */
  placeId?: string;
  className?: string;
}) {
  const live = useOfferSlide(slides);
  const [held, setHeld] = useState<number | null>(null);
  const getSupabase = useLazyBrowserSupabase();
  if (slides.length === 0) return null;
  const index = held ?? live.index;
  const slide = slides[index];
  const hold = () => setHeld((h) => h ?? live.index);
  const release = () => setHeld(null);
  return (
    <PushLink
      href={href}
      aria-label={offersLabel(name, slides)}
      onClick={() => {
        release();
        const voucher = slide.voucher ?? slide.key;
        if (placeId && voucher) {
          trackEvent(getSupabase(), "offer_chip_tap", { place_id: placeId, voucher });
        }
      }}
      onPointerDown={hold}
      onPointerCancel={release}
      onPointerLeave={release}
      className={cn(
        CARD_BUTTON_BOX,
        OFFER_BOX,
        slide.tone,
        "pointer-events-auto focus-visible:ring-primary outline-none focus-visible:ring-2",
        "transition after:absolute after:inset-x-0 after:-inset-y-1.5 hover:opacity-90 active:scale-[0.99]",
        className,
      )}
      data-tile-bonus
    >
      <OfferTrack slides={slides} index={index} previous={held === null ? live.previous : null} short />
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

/** Where a slide's tap goes: the place's Offers page (/place/<id>/offers
 *  since MESITA-4379), no offer's sheet open (MESITA-4358; it ticked the
 *  offer on screen, MESITA-4219). `from=wallet` (MESITA-3883): a paid offer
 *  pops back to the Loyalty Card that opened Offers instead of replacing
 *  Offers with it, and a cold-open Back falls to the card. No forward
 *  control reads it (MESITA-4601). */
export function offerHref(placeHref: string, slide: OfferSlide, fromWallet = false): string {
  return `${placeHref}/offers?rewards=${slide.section ?? "prepayment"}${fromWallet ? "&from=wallet" : ""}`;
}
