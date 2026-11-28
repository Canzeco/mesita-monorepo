"use client";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { useState } from "react";
import { CalendarCheck } from "lucide-react";

import {
  OfferTrack,
  PremierRosette,
  offerSlides as slidesFor,
  offersLabel,
  useOfferSlide,
  type OfferInput,
  type OfferSlide,
} from "@mesita/place-profile";
import { CASHBACK_TONE, STANDARD_BONUS, VOUCHER_TONE, voucherPct } from "@mesita/place-profile/lib/offers";
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
 *  in one box the height of Save · Share, Offers · Welcome, each
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

/** THE OFFERS ON THE PHOTO: PREPAY LEFT, PAY RIGHT (Pato, 2026-11-28,
 *  MESITA-5123: "i want prepay and pay, two buttons. prepay bottom left is
 *  purple. pay bottom right is green. just mention Prepay (X%), Pay (Y%)").
 *  Two still boxes along the photo's bottom, in one black box 8px in on every side. Left,
 *  purple "Prepay X%": the Medium voucher's bonus (MESITA-5099: "select
 *  always the medium prepay bonus"), or the best voucher on sale where the
 *  place does not sell Medium. Right, green "Pay Y%": the place's highest
 *  cashback line. One alone takes the full width (MESITA-5105). Equal
 *  halves where both fit; on a narrow phone Prepay keeps its words and Pay
 *  takes the rest (measured at 360px: 12px type, 4px inside). No icon and
 *  no black percent box: neither fits two boxes on a phone. A label: a tap
 *  opens the place. One green Cashback band before (MESITA-5103).
 *  INSIDE ONE BLACK BOX (Pato, 2026-11-28, MESITA-5125: "put prepay and pay
 *  inside black box"): the two sit in a black box, 4px in on every side and
 *  4px apart, its corners 4px rounder than theirs; it replaces each box's
 *  own black border (MESITA-5091). */
export function OfferDisplay({ offers }: { offers: OfferInput | null | undefined }) {
  const boxes = cardOfferBoxes(offers);
  if (boxes.length === 0) return null;
  return (
    <p
      className="pointer-events-none absolute right-2 bottom-2 left-2 z-10 m-0 grid auto-cols-[minmax(max-content,1fr)] grid-flow-col gap-1 rounded-xl bg-[#141414] p-1"
      aria-label={boxes.map((b) => b.words).join(", ")}
      data-card-offer-display
    >
      {boxes.map((b) => (
        <span
          key={b.key}
          className={cn(
            CARD_BUTTON_BOX,
            "flex items-center justify-center px-1 font-sans text-xs font-semibold whitespace-nowrap tabular-nums",
            b.tone,
          )}
          data-card-offer={b.key}
        >
          {b.words}
        </span>
      ))}
    </p>
  );
}

/** ONE SOURCE FOR A CARD'S TWO OFFERS (MESITA-5129): Home's photo boxes and
 *  Search's band read the same words, numbers and colours. Prepay: Medium's
 *  bonus where the place sells it, else the best standard voucher on sale.
 *  Pay: the place's cashback rate. A side that is 0 is left out; `voucher`
 *  is what a tap reports (offer_chip_tap). */
type CardOfferBox = { key: "prepay" | "pay"; words: string; tone: string; voucher: string };
export function cardOfferBoxes(offers: OfferInput | null | undefined): CardOfferBox[] {
  if (!offers) return [];
  const sold = Object.keys(STANDARD_BONUS).filter((k) => offers.sell.includes(k));
  const lead = offers.sell.includes("voucher_1000")
    ? "voucher_1000"
    : sold.reduce<string | null>((a, b) => (a && voucherPct(offers, a) >= voucherPct(offers, b) ? a : b), null);
  const prepay = lead ? voucherPct(offers, lead) : 0;
  const pay = offers.cashback_pct ?? 0;
  return [
    ...(lead && prepay > 0 ? [{ key: "prepay" as const, words: `Prepay ${prepay}%`, tone: VOUCHER_TONE.voucher_1000, voucher: lead }] : []),
    ...(pay > 0 ? [{ key: "pay" as const, words: `Pay ${pay}%`, tone: CASHBACK_TONE, voucher: "cashback" }] : []),
  ];
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

/** THE BANNER (Pato, 2026-11-26, MESITA-5010; STILL SINCE MESITA-5015:
 *  "when seeing shit in home, don't move banenrs / just red say icon reserve
 *  / and green say icon discounts / use icons"; then "discounts in green").
 *  Nothing moves. Home passes no offers: one red Reserve, the full width
 *  (MESITA-5091), or nothing. Search's map card: Premier · Reserve, then
 *  THE OFFERS IN HOME'S WORDS (Pato, 2026-11-28, MESITA-5129, asked if
 *  Search should say Prepay X% / Pay Y% like Home: "Yes, match Home"):
 *  purple "Prepay X%" and green "Pay Y%" (cardOfferBoxes), each its own
 *  cell, no icon. One green "Cashback X%" cell before (MESITA-5103, 5119),
 *  "Offers" before that (MESITA-5078). The cells share the row in equal
 *  parts where their words fit, and never clip them: measured at 360px with
 *  all four, 6px inside each cell. No black box here (MESITA-5125 is the
 *  photo's): the band has no photo under it.
 *  Reserve opens Reserve; an offer cell opens the place (MESITA-4455). A live
 *  table says Booking, or Booked once the place confirms, in the red button
 *  (MESITA-5014). */
export function PlaceBannerRow({
  name,
  placeId,
  offers,
  reserveHref,
  offerHref,
  reservable,
  reserveLabel,
  reserveDetail,
  premier = false,
  className,
  cellClassName,
}: {
  name: string;
  placeId?: string;
  /** The place's offers, for Search's Prepay and Pay cells; absent = none
   *  (Home shows them on its photo, OfferDisplay). */
  offers?: OfferInput | null;
  /** A gold Premier segment first (Pato, 2026-11-27, MESITA-5094). Search's
   *  map card only; Home keeps Premier on its photo. A label: a tap opens
   *  nothing. */
  premier?: boolean;
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
  const boxes = cardOfferBoxes(offers);
  const showReserve = reservable || holding;
  if (!showReserve && boxes.length === 0 && !premier) return null;
  const kinds = [...(premier ? ["premier"] : []), ...(showReserve ? ["reserve"] : []), ...boxes.map((b) => b.key)];
  return (
    <div
      className={cn("grid w-full auto-cols-[minmax(max-content,1fr)] grid-flow-col", className)}
      data-place-banner={kinds.join("-")}
    >
      {premier ? (
        <span className={cn(CARD_BUTTON_BOX, BANNER_CELL, "bg-[#E9C46A] text-neutral-950", cellClassName)} data-card-premier>
          <PremierRosette className="h-4 w-4 shrink-0" fill="#141414" check="#fff" decorative />
          Premier
        </span>
      ) : null}
      {showReserve ? (
        <PushLink
          href={reserveHref}
          aria-label={
            holding
              ? `${reserveLabel} at ${name}${reserveDetail ? `, ${reserveDetail}` : ""}. Change or cancel it.`
              : `Reserve at ${name}`
          }
          data-card-table={holding ? (reserveLabel === "Booked" ? "booked" : "booking") : undefined}
          className={cn(CARD_BUTTON_BOX, BANNER_CELL, "bg-reserve text-reserve-foreground", cellClassName)}
          data-tile-reserve
        >
          <CalendarCheck className="h-4 w-4 shrink-0" aria-hidden />
          {holding ? reserveLabel : "Reserve"}
        </PushLink>
      ) : null}
      {boxes.map((b) => (
        <PushLink
          key={b.key}
          href={offerHref}
          aria-label={`${b.words} at ${name}`}
          onClick={() => {
            if (placeId) trackEvent(getSupabase(), "offer_chip_tap", { place_id: placeId, voucher: b.voucher });
          }}
          className={cn(CARD_BUTTON_BOX, BANNER_CELL, "tabular-nums", b.tone, cellClassName)}
          data-tile-bonus
          data-card-offer={b.key}
        >
          {b.words}
        </PushLink>
      ))}
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
 *  `rail`: Search's rail card, on Save · Share's line too (MESITA-5066,
 *  Pato: "premier at the bottom"): 12px from the photo's left and bottom,
 *  the rail's step (RAIL_CARD_ACTIONS bottom-3). As wide as the word: the
 *  132px photo is narrower than Save. */
export function PremierPill({
  placement = "save",
  className,
}: {
  /** `top`: Home's card since MESITA-5090 (Pato's sketch: Premier at the
   *  photo's top-left, the offer display along its bottom), 8px in. SAVE'S
   *  SIZE (Pato, MESITA-5117: "premier must be same size than save or share
   *  buttons"): Save's width, (100% − 25px) / 2, and its h-8. */
  placement?: "save" | "rail" | "top";
  className?: string;
}) {
  return (
    <p
      className={cn(
        CARD_BUTTON_BOX,
        "pointer-events-none absolute left-2 z-10 flex items-center justify-center gap-1.5 border border-[#141414] bg-[#E9C46A] px-2.5 font-sans text-sm font-semibold text-neutral-950",
        placement === "top" ? "top-2 w-[calc((100%-25px)/2)]" : placement === "save" ? "bottom-[9px] w-[calc((100%-25px)/2)]" : "bottom-3 left-3",
        className,
      )}
      data-card-premier
    >
      <PremierRosette className="h-4 w-4" fill="#141414" check="#fff" decorative />
      Premier
    </p>
  );
}

/** One still banner cell: a mark and a word, centred, never wrapped. 6px
 *  inside and 4px between mark and word (8 and 6 before): Search's four
 *  cells fit a 360px phone (MESITA-5129). */
const BANNER_CELL =
  "pointer-events-auto relative flex min-w-0 items-center justify-center gap-1 px-1.5 font-sans text-xs font-semibold whitespace-nowrap focus-visible:ring-primary outline-none focus-visible:ring-2";

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
