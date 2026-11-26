"use client";

import { PushLink } from "@/components/consumer/nav/PushLink";
import { useMemo, useState, useSyncExternalStore } from "react";

import {
  OfferTrack,
  ROW_TICK_MS,
  ROW_TICKS_PER_CHANGE,
  offerSlides as slidesFor,
  offersLabel,
  useOfferSlide,
  type OfferSlide,
} from "@mesita/place-profile";
import { hoursTable } from "@mesita/place-profile/helpers";
import { reserveTimes } from "@mesita/place-profile/lib/reserve-times";
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

/** One clock for every card, so a list does not start a timer per row. The
 *  server render reads null (the word Reserve); the times appear once the
 *  page runs, and move on as the hour passes. */
const TEN_MIN = 600_000;
const tenMinListeners = new Set<() => void>();
let tenMinTimer: ReturnType<typeof setInterval> | null = null;
function subscribeTenMin(listener: () => void) {
  tenMinListeners.add(listener);
  tenMinTimer ??= setInterval(() => {
    for (const l of tenMinListeners) l();
  }, TEN_MIN);
  return () => {
    tenMinListeners.delete(listener);
    if (tenMinListeners.size === 0 && tenMinTimer) {
      clearInterval(tenMinTimer);
      tenMinTimer = null;
    }
  };
}
function useTenMinuteClock(): number | null {
  return useSyncExternalStore(subscribeTenMin, () => Math.floor(Date.now() / TEN_MIN), () => null);
}

/** THE BANNER (Pato, 2026-11-26, MESITA-5010 and MESITA-5011). Reservations
 *  only: one red Reserve, the full width. Both: Reserve and the offer, each
 *  half. Offers only: the offer, the full width. Neither: nothing, and
 *  Save · Share stay. RESERVE IS THE ONE THAT MOVES (MESITA-5011): the red
 *  button rotates the place's open times, the same ones as the place screen,
 *  every 2 seconds. Beside Reserve the green half is too small for an
 *  amount, so it says Offers (MESITA-5013). Alone, the offer keeps its
 *  amount. Either way it opens the place (MESITA-4455). Reserve opens
 *  Reserve. A live table says Booking, or Booked once the place confirms,
 *  in that same button, and the times stop (MESITA-5014). */
export function PlaceBannerRow({
  name,
  placeId,
  slides,
  hours,
  timezone,
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
  const clock = useTenMinuteClock();
  const timeSlides = useMemo<OfferSlide[]>(() => {
    if (!reservable || holding || clock === null) return [];
    return reserveTimes({ hours_table: hoursTable(hours), timezone: timezone ?? "" }, clock * TEN_MIN).map((t) => ({
      key: `${t.day}-${t.time}`,
      lead: t.day,
      pill: t.time,
      pillShort: t.time,
      short: t.day,
      spoken: `${t.day} ${t.time}`,
      section: null,
      tone: "",
    }));
  }, [reservable, holding, clock, hours, timezone]);
  const times = useOfferSlide(timeSlides, ROW_TICK_MS, { every: ROW_TICKS_PER_CHANGE });
  const getSupabase = useLazyBrowserSupabase();
  const canOffer = slides.length > 0;
  const showReserve = reservable || holding;
  if (!showReserve && !canOffer) return null;
  const cells: Array<"reserve" | "offer"> =
    showReserve && canOffer ? ["reserve", "offer"] : showReserve ? ["reserve"] : ["offer"];
  const offer = slides[0];
  const tight = cells.length === 2;
  return (
    <div
      className={cn("grid gap-2", cells.length === 2 ? "grid-cols-2" : "grid-cols-1", className)}
      data-place-banner
    >
      {cells.map((kind, i) =>
        kind === "reserve" ? (
          <PushLink
            key={`${kind}-${i}`}
            href={reserveHref}
            aria-label={
              holding
                ? `${reserveLabel} at ${name}${reserveDetail ? `, ${reserveDetail}` : ""}. Change or cancel it.`
                : timeSlides.length > 0
                  ? `Reserve at ${name}, ${timeSlides.length} times, from ${timeSlides[0].spoken}`
                  : `Reserve at ${name}`
            }
            data-card-table={holding ? (reserveLabel === "Booked" ? "booked" : "booking") : undefined}
            className={cn(
              CARD_BUTTON_BOX,
              "bg-reserve text-reserve-foreground pointer-events-auto relative flex items-center justify-center px-2 text-xs font-semibold",
              "focus-visible:ring-primary outline-none focus-visible:ring-2",
              cellClassName,
            )}
            data-tile-reserve
          >
            {holding ? (
              reserveLabel
            ) : timeSlides.length > 0 ? (
              <OfferTrack slides={timeSlides} index={times.index} previous={times.previous} />
            ) : (
              "Reserve"
            )}
          </PushLink>
        ) : (
          <PushLink
            key={`${kind}-${i}`}
            href={offerHref}
            aria-label={offersLabel(name, slides)}
            onClick={() => {
              const voucher = offer?.voucher ?? offer?.key;
              if (placeId && voucher) {
                trackEvent(getSupabase(), "offer_chip_tap", { place_id: placeId, voucher });
              }
            }}
            className={cn(
              CARD_BUTTON_BOX,
              OFFER_BOX,
              tight ? "bg-[#00D66F] text-neutral-950" : offer?.tone,
              "pointer-events-auto focus-visible:ring-primary outline-none focus-visible:ring-2",
              cellClassName,
            )}
            data-tile-bonus
          >
            {tight ? "Offers" : offer ? <OfferTrack slides={slides} index={0} previous={null} short /> : null}
          </PushLink>
        ),
      )}
    </div>
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
