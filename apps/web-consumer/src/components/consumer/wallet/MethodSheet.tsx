"use client";

import { useState } from "react";
import { brandLabel, expiryLabel, type SavedCard } from "@/lib/api/cards";
import { cardFace } from "@/components/shared/card-brand-marks";
import { cn } from "@/lib/utils";
import { SECONDARY } from "./wallet-buttons";

// A PAYMENT METHOD, FULL SCREEN (Pato, MESITA-3533): a saved card, opened
// from a Wallet rail. A place's credit is a page of its own,
// /wallet/place/<placeId> (PlaceCredit.tsx, MESITA-3614).

export type Method = { kind: "card"; card: SavedCard };

/** A saved card (MESITA-3523): what Stripe told us about it, and Remove.
 *  A card a Premier plan renews with says so and offers no Remove. */
export function CardBody({ card, onRemove }: { card: SavedCard; onRemove?: (card: SavedCard) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const face = cardFace(card.brand, brandLabel(card.brand));
  return (
    <>
      <div className={cn("flex aspect-[1.586/1] w-full flex-col justify-between rounded-2xl p-5", face.className)} style={face.style}>
        {face.mark}
        <div>
          <p className="text-xl font-semibold tabular-nums">•••• {card.last4}</p>
          <p className="mt-0.5 text-sm tabular-nums opacity-70">Expires {expiryLabel(card)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 text-sm leading-relaxed">
        <p>Saved on your Mesita account. Stripe keeps the card number; Mesita only sees the last four digits.</p>
        {card.in_use ? <p data-card-in-use>This card pays your Premier plan. To remove it, change the plan&apos;s card first.</p> : null}
      </div>
      {card.in_use || !onRemove ? null : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void onRemove(card).finally(() => setBusy(false));
          }}
          className={`${SECONDARY} mt-5 disabled:opacity-60`}
          data-card-remove
        >
          {busy ? "Removing…" : "Remove card"}
        </button>
      )}
    </>
  );
}

/** Cash (MESITA-4116; redesigned MESITA-4125, Pato: "don't make cash look as
 *  a card ... just mention like pay with cash, or pay in their terminal ...
 *  redesign this page from scratch"). No card face: two panels and a line.
 *  How you pay: cash, or the place's terminal, both outside the app. Every
 *  icon disc is grey (MESITA-4129, Pato: "why all fucking green").
 *  The rates are the most a place gives; each place turns either on or off. */
