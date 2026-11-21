"use client";

import { offerSlides, SizedImg, type OfferInput } from "@mesita/place-profile";
import { OfferButton } from "@/components/consumer/offer-button";
import { cn } from "@/lib/utils";
import { PlacePhoto } from "./pay-common";

// A WALLET PLACE CARD (Pato, 2026-11-21, MESITA-4519, /plan-design-review):
// two halves. Left: the photo and name, then the balance beside a mini card
// cut from the place's photo (no credit: the distance instead). Right: the
// place's offers on the shared beat, the same slides as Home and the place
// screen; a tap there opens the place. No offers: the left half takes the
// whole card. A tap on the left half selects the card for the page's Pay;
// nothing is selected until the guest taps one. One line each before
// (MESITA-4504), with a second tap to open.

export function PlaceActionRow({
  name,
  photo = null,
  amount,
  distance = null,
  subtitle,
  offers = null,
  placeHref,
  placeId,
  selected = false,
  disabled = false,
  onSelect,
}: {
  name: string;
  /** The place picture. A missing one still draws the initial. */
  photo?: string | null;
  /** Plain amount. Absent when they hold nothing here. */
  amount?: string | null;
  /** "350 m" when they hold nothing here and the place is located. */
  distance?: string | null;
  subtitle?: string | null;
  /** What the guest can buy here now; none hides the offers half. */
  offers?: OfferInput | null;
  /** The place page the offers half opens. */
  placeHref?: string;
  placeId?: string;
  selected?: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  const slides = disabled || !placeHref ? [] : offerSlides(offers);
  return (
    <div
      className={cn(
        "bg-card flex w-full items-stretch gap-2 overflow-hidden rounded-2xl border",
        selected ? "border-foreground border-2" : "border-border",
      )}
      data-wallet-row
      data-selected={selected ? "true" : undefined}
    >
      <button
        type="button"
        disabled={disabled}
        aria-pressed={disabled ? undefined : selected}
        aria-label={
          disabled
            ? `${name}. ${subtitle ?? "Ask Mesita support to use it."}`
            : `${selected ? "Selected" : "Select"} ${name}${amount ? `, ${amount}` : ""}`
        }
        onClick={() => {
          if (!disabled && !selected) onSelect?.();
        }}
        className={cn(
          "flex min-h-24 min-w-0 flex-1 flex-col justify-center gap-2 px-3 py-3 text-left",
          disabled && "cursor-default",
        )}
      >
        <span className="flex min-w-0 items-center gap-3">
          <PlacePhoto place={{ photo, name }} className="h-10 w-10" />
          <span className="text-foreground min-w-0 flex-1 truncate text-base font-semibold">
            {name}
          </span>
        </span>
        {subtitle ? (
          <span className="text-muted-foreground block truncate text-sm">
            {subtitle}
          </span>
        ) : amount ? (
          <span className="flex items-center gap-2">
            <MiniCard photo={photo} name={name} />
            <span className="text-foreground text-base font-semibold tabular-nums">
              {amount}
            </span>
          </span>
        ) : distance ? (
          <span className="text-muted-foreground block text-sm">
            {distance} away
          </span>
        ) : null}
      </button>
      {slides.length > 0 && placeHref ? (
        <div className="flex w-[42%] shrink-0 py-2 pr-2">
          <OfferButton
            href={placeHref}
            name={name}
            slides={slides}
            placeId={placeId}
            className="h-full min-h-20 rounded-xl text-sm"
          />
        </div>
      ) : null}
    </div>
  );
}

/** The Loyalty Card's face (MESITA-4519): 32x20, the place's photo. */
function MiniCard({ photo, name }: { photo: string | null; name: string }) {
  return (
    <span
      className="bg-foreground h-5 w-8 shrink-0 overflow-hidden rounded-[4px] ring-1 ring-black/10"
      aria-hidden
    >
      {photo ? (
        <SizedImg
          src={photo}
          size="thumb"
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <span className="text-background type-meta flex h-full w-full items-center justify-center font-bold">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
