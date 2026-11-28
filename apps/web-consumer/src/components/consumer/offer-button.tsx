"use client";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { useState } from "react";
import { BadgePercent, CalendarCheck, QrCode } from "lucide-react";

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
 *  Two still boxes along the photo's bottom, 8px in on every side. Left,
 *  purple "Prepay X%": the Medium voucher's bonus (MESITA-5099: "select
 *  always the medium prepay bonus"), or the best voucher on sale where the
 *  place does not sell Medium. Right, green "Pay Y%": the place's highest
 *  cashback line. One alone takes the full width (MESITA-5105). Equal
 *  halves where both fit; on a narrow phone Prepay keeps its words and Pay
 *  takes the rest (measured at 360px: 12px type, 4px inside). No icon and
 *  no black percent box: neither fits two boxes on a phone. A label: a tap
 *  opens the place. One green Cashback band before (MESITA-5103). */
export function OfferDisplay({ offers }: { offers: OfferInput | null | undefined }) {
  const prepay = cardPrepayPct(offers);
  const pay = offers?.cashback_pct ?? 0;
  const boxes = [
    ...(prepay > 0 ? [{ key: "prepay", words: `Prepay ${prepay}%`, tone: VOUCHER_TONE.voucher_1000 }] : []),
    ...(pay > 0 ? [{ key: "pay", words: `Pay ${pay}%`, tone: CASHBACK_TONE }] : []),
  ];
  if (boxes.length === 0) return null;
  return (
    <p
      className="pointer-events-none absolute right-2 bottom-2 left-2 z-10 m-0 grid auto-cols-[minmax(max-content,1fr)] grid-flow-col gap-2"
      aria-label={boxes.map((b) => b.words).join(", ")}
      data-card-offer-display
    >
      {boxes.map((b) => (
        <span
          key={b.key}
          className={cn(
            CARD_BUTTON_BOX,
            "flex items-center justify-center border border-[#141414] px-1 font-sans text-xs font-semibold whitespace-nowrap tabular-nums",
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

/** The card's Prepay percent: Medium's bonus where the place sells it, else
 *  the best standard voucher on sale; 0 = the place sells none. */
function cardPrepayPct(offers: OfferInput | null | undefined): number {
  if (!offers) return 0;
  if (offers.sell.includes("voucher_1000")) return voucherPct(offers, "voucher_1000");
  return Math.max(0, ...Object.keys(STANDARD_BONUS).filter((k) => offers.sell.includes(k)).map((k) => voucherPct(offers, k)));
}

/** "Cashback" then the percent in a small black box, white type (Pato,
 *  2026-11-28, MESITA-5119: "put the 5% or x% in a black box white
 *  letters"). Search's green cell; Home's photo says "Pay Y%" (MESITA-5123). */
function CashbackWords({ pct }: { pct: number }) {
  return (
    <>
      Cashback
      <span className="rounded bg-neutral-950 px-1.5 py-0.5 leading-none text-white tabular-nums">{pct}%</span>
    </>
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

/** The green button's word (Pato, 2026-11-27, MESITA-5078: "change from
 *  prepay in green to offers, is cleaner"). Every offer says Offers. It said
 *  Prepay under MESITA-5056, Bonus under MESITA-5054, and Off for a visit
 *  discount under MESITA-5050. Tickets and receipts still name the bonus
 *  amount Bonus. */
// THE CASHBACK ITSELF (Pato, 2026-11-28, MESITA-5103: "instead of saying
// offers, mention the actual cashback. 5% Cashback or 10% Cashback"): the
// place's cashback where it gives one; Offers only where it gives none.
export function offerBannerWord(_slides: OfferSlide[], cashbackPct?: number | null): string {
  return cashbackPct && cashbackPct > 0 ? `Cashback ${cashbackPct}%` : "Offers"; // "Cashback 5%" (MESITA-5118)
}

/** THE BANNER (Pato, 2026-11-26, MESITA-5010; STILL SINCE MESITA-5015:
 *  "when seeing shit in home, don't move banenrs / just red say icon reserve
 *  / and green say icon discounts / use icons"; then "discounts in green").
 *  Nothing moves. Reservations only: one red Reserve, the full width
 *  (MESITA-5021: the left half grows from 50% to 100%). Offers only: one
 *  green Offers, the full width (the right half grows from 50% to 100%).
 *  Both: Reserve left, Offers right, each half. Neither: nothing, and
 *  Save · Share stay.
 *  Reserve opens Reserve; Offers opens the place (MESITA-4455). A live
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
  premier = false,
  cashbackPct,
  className,
  cellClassName,
}: {
  name: string;
  placeId?: string;
  slides: OfferSlide[];
  /** THREE COLOURS ON TOP (Pato, 2026-11-27, MESITA-5094, design 1 of 5:
   *  "Premier, Reserve, Offers … three things on the top, three colours is
   *  okay, and that's it"): a gold Premier segment first. Search's map card
   *  only; Home keeps Premier on its photo. A label: a tap opens nothing. */
  premier?: boolean;
  /** The place's highest cashback line (MESITA-5103): the green cell says it. */
  cashbackPct?: number | null;
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
  if (!showReserve && !canOffer && !premier) return null;
  const cells: Array<"premier" | "reserve" | "offer"> = [
    ...(premier ? (["premier"] as const) : []),
    ...(showReserve ? (["reserve"] as const) : []),
    ...(canOffer ? (["offer"] as const) : []),
  ];
  const offer = slides[0];
  return (
    <div
      className={cn("flex w-full", className)}
      data-place-banner={cells.length === 1 ? cells[0] : cells.includes("premier") ? cells.join("-") : "both"}
    >
      {cells.map((kind, i) =>
        kind === "premier" ? (
          <span
            key={`${kind}-${i}`}
            className={cn(
              CARD_BUTTON_BOX,
              BANNER_CELL,
              "min-w-0 flex-1",
              "bg-[#E9C46A] text-neutral-950",
              cellClassName,
              "shrink",
            )}
            data-card-premier
          >
            <PremierRosette className="h-4 w-4 shrink-0" fill="#141414" check="#fff" decorative />
            Premier
          </span>
        ) : kind === "reserve" ? (
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
            {/* Cashback shows the Pay tab's QR, Offers the percent badge (MESITA-5116). */}
            {cashbackPct && cashbackPct > 0 ? (
              <QrCode className="h-4 w-4 shrink-0" aria-hidden />
            ) : (
              <BadgePercent className="h-4 w-4 shrink-0" aria-hidden />
            )}
            {cashbackPct && cashbackPct > 0 ? (
              <CashbackWords pct={cashbackPct} />
            ) : (
              offerBannerWord(slides, cashbackPct)
            )}
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
