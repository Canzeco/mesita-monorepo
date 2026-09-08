"use client";

// The saved payment methods for Mesita Pay — the card rail Stripe Connect
// prepares on the place side (#1415).
//
// TWO DOORWAYS (Pato, 2026-08-31). Opened from Me › Profile and from Pay ›
// Wallet › Payment methods. What the two share is no longer this SHEET: it is
// `CardList` and `useConsumerCards` beside it (MESITA-1672), because the
// Wallet renders cards inline with its own section header and cannot mount a
// sheet to do it. The rule the old comment protected is unchanged and is now
// enforced one level down — the live Stripe flow still has exactly one
// definition.
//
// This is the one LIVE thing on the Wallet screen. The parked framing there
// covers the Credits emulator and must never be read as covering these cards.
//
// Adding a card leaves the app: the number is typed on Stripe's hosted page,
// which is what keeps this codebase out of PCI scope. The return trip lands on
// /me?cards=added and re-opens this sheet from a server prop.

import { CreditCard } from "lucide-react";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import {
  AddCardButton,
  CardList,
  CardsDisclosure,
  useConsumerCards,
} from "@/components/consumer/me/CardList";
import { PRIMARY_BUTTON_CLASS, SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

export function CardsModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const state = useConsumerCards(open);

  return (
    <LocalSheet open={open} onClose={onClose} ariaLabel="Cards">
      <div className={SHEET_BODY_CLASS}>
        <div className="flex items-center gap-2.5">
          <span className="bg-primary/10 text-primary grid size-9 place-items-center rounded-xl">
            <CreditCard
              className="size-[18px]"
              strokeWidth={2.25}
              aria-hidden
            />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Cards</h2>
            <p className="text-muted-foreground text-xs">
              Saved cards for Premium and Mesita Pay
            </p>
          </div>
        </div>

        <div className="mt-4">
          <CardList state={state} />
        </div>

        {/* The sheet puts Add UNDER the list; Pay › Wallet puts it top-right
            of its section header. Same button, same handler, each mount laying
            itself out — which is the whole reason the state left this file. */}
        <AddCardButton state={state} className={cn(PRIMARY_BUTTON_CLASS, "mt-4")} />

        <CardsDisclosure mock={state.mock} className="mt-3" />
      </div>
    </LocalSheet>
  );
}
