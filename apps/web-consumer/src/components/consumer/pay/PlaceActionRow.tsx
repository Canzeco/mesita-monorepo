"use client";

import { SizedImg } from "@mesita/place-profile";
import { ChevronRight, Clock3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PendingBox } from "@/components/consumer/wallet/WalletLists";
import { PAY_ROW, PAY_ROW_META, PAY_ROW_TEXT, PAY_THUMB } from "./pay-sections";

// A ROW OF PAY'S LOYALTY CARDS BOX (MESITA-4560). History: a bank-card-sized
// card with an Offers tile (MESITA-4520), two loose lines (MESITA-4525), a
// 2x2 grid of boxes (MESITA-4531/4537).

export function PlaceActionRow({
  name,
  photo = null,
  amount,
  distance = null,
  subtitle,
  pending = null,
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
  /** "$50.00MX" still landing here: shown in the Wallet's blue box under the row. */
  pending?: string | null;
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
    <div data-wallet-row data-place-id={placeId}>
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
        className={cn(PAY_ROW, disabled && "cursor-default opacity-60")}
        data-loyalty-card
      >
        <MiniCard photo={photo} name={name} />
        <span className={cn(PAY_ROW_TEXT, "min-w-0 flex-1 truncate")}>{name}</span>
        {subtitle ? (
          <span className={cn(PAY_ROW_META, "max-w-[45%] shrink-0 truncate")}>{subtitle}</span>
        ) : amount ? (
          // THE BALANCE IN A BLACK PILL (Pato, 2026-11-21, MESITA-4586: "balance
          // put it in a black box with white text, just to make it clearer").
          <span
            className="bg-foreground text-background shrink-0 rounded-lg px-2 py-1 text-base font-semibold tabular-nums"
            data-loyalty-balance
          >
            {amount}
          </span>
        ) : distance ? (
          <span className={cn(PAY_ROW_META, "shrink-0")}>{distance}</span>
        ) : null}
        {/* A › AFTER THE BALANCE (Pato, 2026-11-21, MESITA-4598: "at the right
            of balance use this icon > to express that you can open that
            card"). */}
        {disabled ? null : <ChevronRight className="text-muted-foreground -ml-1 h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />}
      </button>
      {/* MONEY ON ITS WAY, UNDER THE CARD (Pato, 2026-11-21, MESITA-4594:
          "if bonus pending, lit it below the loyalty card in that blue box
          and make loylaty card conatiner taller"): the Loyalty Card page's
          blue PendingBox, the row growing to hold it; it opens the card. */}
      {pending && !disabled ? (
        <button type="button" onClick={() => onOpen?.()} className="block w-full px-3 pb-3 text-left" data-loyalty-card-pending>
          <PendingBox icon={Clock3}>{pending} pending</PendingBox>
        </button>
      ) : null}
    </div>
  );
}

/** The Loyalty Card's face, small: Pay's one 48x32 thumbnail (MESITA-4578), the place's photo. */
function MiniCard({ photo, name }: { photo: string | null; name: string }) {
  return (
    <span className={cn(PAY_THUMB, "bg-foreground relative ring-1 ring-black/10")} aria-hidden>
      {photo ? (
        <SizedImg src={photo} size="thumb" alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="text-background flex h-full w-full items-center justify-center text-sm font-semibold">
          {name.trim().charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  );
}
