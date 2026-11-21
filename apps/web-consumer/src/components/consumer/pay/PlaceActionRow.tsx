"use client";

import { SizedImg } from "@mesita/place-profile";
import { cn } from "@/lib/utils";

// A ROW OF PAY'S LOYALTY CARDS BOX (MESITA-4560). History: a bank-card-sized
// card with an Offers tile (MESITA-4520), two loose lines (MESITA-4525), a
// 2x2 grid of boxes (MESITA-4531/4537).

export function PlaceActionRow({
  name,
  photo = null,
  amount,
  distance = null,
  subtitle,
  placeId,
  disabled = false,
  onOpen,
}: {
  name: string;
  /** The place picture. A missing one leaves the card black with the initial. */
  photo?: string | null;
  /** Plain amount. Absent when they hold nothing here. */
  amount?: string | null;
  /** "350 m" when the place is located. */
  distance?: string | null;
  subtitle?: string | null;
  placeId?: string;
  disabled?: boolean;
  /** The first line's tap: its Loyalty Card page (or the place). */
  onOpen?: () => void;
}) {
  return (
    // TWO LINES IN ONE BOX OF ROWS (Pato, 2026-11-21, MESITA-4560: "each
    // card must be two lines of height. first line … the place card, then
    // the name, and at the right the amount. then below … the offers of
    // bonuses available"; /plan-design-review D1-D3): a row of the Loyalty
    // Cards box, a hairline between places. Line 1 opens the Loyalty Card;
    // line 2 is the moving offer at full width (Home's OfferButton), opening
    // the place. No offers: one line. The 2x2 grid of MESITA-4531/4537
    // before. ONE LINE, NO OFFERS (Pato, 2026-11-21, MESITA-4573: "don't
    // show offers in loyalty cards … show them but nested, but not there
    // outside. that must only be the list"): the moving offer line is gone;
    // the offers live one tap in, on the Loyalty Card page and the place.
    <div className="px-3 py-2.5" data-wallet-row data-place-id={placeId}>
      <button
        type="button"
        disabled={disabled}
        aria-label={
          disabled
            ? `${name}. ${subtitle ?? "Ask Mesita support to use it."}`
            : amount
              ? `${name}, balance ${amount}`
              : distance
                ? `${name}, ${distance} away`
                : name
        }
        onClick={() => {
          if (!disabled) onOpen?.();
        }}
        className={cn("flex min-h-11 w-full min-w-0 items-center gap-3 text-left", disabled && "cursor-default opacity-60")}
        data-loyalty-card
      >
        <MiniCard photo={photo} name={name} />
        <span className="text-foreground min-w-0 flex-1 truncate text-base font-semibold">{name}</span>
        {subtitle ? (
          <span className="text-muted-foreground max-w-[45%] shrink-0 truncate text-sm">{subtitle}</span>
        ) : amount ? (
          <span className="text-foreground shrink-0 text-base font-bold tabular-nums" data-loyalty-balance>
            {amount}
          </span>
        ) : distance ? (
          <span className="text-muted-foreground shrink-0 text-sm">{distance}</span>
        ) : null}
      </button>
    </div>
  );
}

/** The Loyalty Card's face, small (MESITA-4525): 40x26, the place's photo. */
function MiniCard({ photo, name }: { photo: string | null; name: string }) {
  return (
    <span className="bg-foreground relative h-[26px] w-10 shrink-0 overflow-hidden rounded-[5px] ring-1 ring-black/10" aria-hidden>
      {photo ? (
        <SizedImg src={photo} size="thumb" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="text-background type-meta flex h-full w-full items-center justify-center font-bold">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
