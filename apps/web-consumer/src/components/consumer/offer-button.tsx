"use client";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { useState } from "react";
import { BadgePercent, CalendarCheck } from "lucide-react";

import {
  OfferTrack,
  PremierRosette,
  offerSlides as slidesFor,
  offersLabel,
  useOfferSlide,
  type OfferSlide,
} from "@mesita/place-profile";
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
 *  in one box the height of Save · Share, Prepay · Welcome, each
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
          trackEvent(getSupabase(), "offer_chip_tap", {
            place_id: placeId,
            voucher,
          });
        }
      }}
      onPointerDown={hold}
      onPointerCancel={release}
      onPointerLeave={release}
      className={cn(
        CARD_BUTTON_BOX,
        OFFER_BOX,
        slide.tone,
        "focus-visible:ring-primary pointer-events-auto outline-none focus-visible:ring-2",
        "transition after:absolute after:inset-x-0 after:-inset-y-1.5 hover:opacity-90 active:scale-[0.99]",
        className,
      )}
      data-tile-bonus
    >
      <OfferTrack
        slides={slides}
        index={index}
        previous={held === null ? live.previous : null}
        short
      />
    </PushLink>
  );
}

/** A list card may show Reserve (MESITA-5021). The switch has to be on and
 *  the row has to carry a phone: with neither, the call cannot be placed, and
 *  a missing flag is not a yes. The Reservations phone stays off this payload;
 *  the place screen's own `reservable` still sees it. */
export function listCardReservable(place: {
  reservations_enabled?: boolean | null;
  phone?: string | null;
}): boolean {
  return place.reservations_enabled === true && (place.phone ?? "").trim() !== "";
}

/** The green button's word (Pato, 2026-11-27, MESITA-5056: "Don't call it
 *  Bonus, call it Prepay"). Every offer says Prepay. It said Bonus under
 *  MESITA-5054, and Off for a visit discount under MESITA-5050. Tickets and
 *  receipts still name the bonus amount Bonus. */
export function offerBannerWord(_slides: OfferSlide[]): "Prepay" {
  return "Prepay";
}

/** THE BANNER (Pato, 2026-11-26, MESITA-5010; STILL SINCE MESITA-5015:
 *  "when seeing shit in home, don't move banenrs / just red say icon reserve
 *  / and green say icon discounts / use icons"; then "discounts in green").
 *  Nothing moves. Reservations only: one red Reserve, the full width
 *  (MESITA-5021: the left half grows from 50% to 100%). Offers only: one
 *  green Prepay, the full width (the right half grows from 50% to 100%).
 *  Both: Reserve left, Prepay right, each half. Neither: nothing, and
 *  Save · Share stay.
 *  Reserve opens Reserve; Prepay opens the place (MESITA-4455). A live
 *  table says Booking, or Booked once the place confirms, in the red button
 *  (MESITA-5014). The open times that rotated in Reserve (MESITA-5011) are
 *  gone from the card; the place screen keeps them. */
export function PlaceBannerRow({
  name,
  placeId,
  slides,
  reserveHref,
  offerHref,
  reservable,
  reserveLabel,
  reserveDetail,
  className,
  cellClassName,
}: {
  name: string;
  placeId?: string;
  slides: OfferSlide[];
  /** Read by the place screen's times; the still card does not need them. */
  hours?: unknown;
  timezone?: string | null;
  reserveHref: string;
  offerHref: string;
  reservable: boolean;
  /** A live table: the reserve button says this instead of Reserve. */
  reserveLabel?: string;
  /** The table's day and time, for the button's spoken label. */
  reserveDetail?: string;
  className?: string;
  cellClassName?: string;
}) {
  const holding = Boolean(reserveLabel);
  const getSupabase = useLazyBrowserSupabase();
  const canOffer = slides.length > 0;
  const showReserve = reservable || holding;
  if (!showReserve && !canOffer) return null;
  const cells: Array<"reserve" | "offer"> =
    showReserve && canOffer
      ? ["reserve", "offer"]
      : showReserve
        ? ["reserve"]
        : ["offer"];
  const offer = slides[0];
  return (
    <div
      className={cn("flex w-full", className)}
      data-place-banner={cells.length === 2 ? "both" : cells[0]}
    >
      {cells.map((kind, i) =>
        kind === "reserve" ? (
          <PushLink
            key={`${kind}-${i}`}
            href={reserveHref}
            aria-label={
              holding
                ? `${reserveLabel} at ${name}${reserveDetail ? `, ${reserveDetail}` : ""}. Change or cancel it.`
                : `Reserve at ${name}`
            }
            data-card-table={
              holding
                ? reserveLabel === "Booked"
                  ? "booked"
                  : "booking"
                : undefined
            }
            className={cn(
              CARD_BUTTON_BOX,
              BANNER_CELL,
              "min-w-0 flex-1",
              "bg-reserve text-reserve-foreground",
              cellClassName,
              "shrink",
            )}
            data-tile-reserve
          >
            <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden />
            {holding ? reserveLabel : "Reserve"}
          </PushLink>
        ) : (
          <PushLink
            key={`${kind}-${i}`}
            href={offerHref}
            aria-label={offersLabel(name, slides)}
            onClick={() => {
              const voucher = offer?.voucher ?? offer?.key;
              if (placeId && voucher) {
                trackEvent(getSupabase(), "offer_chip_tap", {
                  place_id: placeId,
                  voucher,
                });
              }
            }}
            className={cn(
              CARD_BUTTON_BOX,
              BANNER_CELL,
              "min-w-0 flex-1",
              // Stripe Link's green, every offer's colour (MESITA-4210).
              "bg-[#00D66F] text-neutral-950",
              cellClassName,
              "shrink",
            )}
            data-tile-bonus
          >
            <BadgePercent className="h-4 w-4 shrink-0" aria-hidden />
            {offerBannerWord(slides)}
          </PushLink>
        ),
      )}
    </div>
  );
}

/** A Premier place on a card: a gold pill on the photo, the card buttons'
 *  box (CARD_BUTTON_BOX) with a 1px black border (MESITA-5063: the border
 *  keeps the gold visible on a bright photo). The VIP gold, dark type, a
 *  black rosette (MESITA-5052). A label, so a tap falls through to the photo.
 *
 *  `save`: Home's card. SAVE'S MIRROR on the photo (Pato, MESITA-5065:
 *  "premier at the bottom … symmetrical to save button but on top of the
 *  image"): Save's width, (100% − 25px) / 2 (the photo and the info box are
 *  the same width; the info box spends 1px of border, 2 × 8px of padding and
 *  the 8px gap), 8px from the left, 9px up (its border + 8px) so it shares
 *  Save · Share's line.
 *  `corner`: Search's rail card, whose buttons sit under the text: the
 *  photo's top-left corner, as wide as the word. */
export function PremierPill({
  placement = "save",
  className,
}: {
  placement?: "save" | "corner";
  className?: string;
}) {
  return (
    <p
      className={cn(
        CARD_BUTTON_BOX,
        "pointer-events-none absolute left-2 z-10 flex items-center justify-center gap-1.5 border border-[#141414] bg-[#E9C46A] px-2.5 font-sans text-sm font-semibold text-neutral-950",
        placement === "save" ? "bottom-[9px] w-[calc((100%-25px)/2)]" : "top-2",
        className,
      )}
      data-card-premier
    >
      <PremierRosette className="h-4 w-4" fill="#141414" check="#fff" decorative />
      Premier
    </p>
  );
}

/** One still banner cell: a mark and a word, centred. */
const BANNER_CELL =
  "pointer-events-auto relative flex items-center justify-center gap-1.5 px-2 font-sans text-xs font-semibold focus-visible:ring-primary outline-none focus-visible:ring-2";

/** The Search map card's top strip (MESITA-3444): the same slides on the
 *  same beat (MESITA-3467), part of the card (its tap opens the place). */
export function OfferStrip({
  name,
  slides,
  className,
}: {
  name: string;
  slides: OfferSlide[];
  className?: string;
}) {
  const live = useOfferSlide(slides);
  if (slides.length === 0) return null;
  return (
    <p
      className={cn(
        CARD_BUTTON_BOX,
        OFFER_BOX,
        slides[live.index].tone,
        "pointer-events-none",
        className,
      )}
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
export function offerHref(
  placeHref: string,
  slide: OfferSlide,
  fromWallet = false,
): string {
  return `${placeHref}/offers?rewards=${slide.section ?? "prepayment"}${fromWallet ? "&from=wallet" : ""}`;
}
