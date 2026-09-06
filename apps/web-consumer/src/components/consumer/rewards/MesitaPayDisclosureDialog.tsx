"use client";

import { CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import {
  SHEET_TITLE_CLASS,
  SHEET_BODY_CLASS,
  SHEET_CANCEL_BUTTON_CLASS,
} from "@/lib/ui-classes";

// One-time disclosure before a guest's FIRST Mesita Pay charge at a given
// place (MESITA-1414, Pato decision 2026-09-02): cloning their saved card
// onto the place's connected Stripe account creates a Customer record
// inside that restaurant's own dashboard. A confirm, not a sheet — same law
// as DeleteAccountSheet: one paragraph and two buttons reads as a stop.

export function MesitaPayDisclosureDialog({
  open,
  onClose,
  onAccept,
  placeName,
}: {
  open: boolean;
  onClose: () => void;
  onAccept: () => void;
  placeName: string;
}) {
  return (
    <LocalDialog open={open} onClose={onClose} ariaLabel="Pay with Mesita Pay">
      <div className={cn(SHEET_BODY_CLASS, "overflow-y-auto")}>
        <div className="flex items-start gap-3">
          <span className="bg-primary/10 text-primary flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl">
            <CreditCard className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className={SHEET_TITLE_CLASS}>Pay with your card</h2>
            <p className="text-muted-foreground text-xs">
              One thing before your first charge here
            </p>
          </div>
        </div>

        <p className="text-muted-foreground type-body mt-4 leading-snug">
          Paying {placeName} with Mesita Pay creates a customer record for
          you inside {placeName}&apos;s own Stripe account — same as
          checking out on their own site. Your card details never leave
          Stripe; this is just who holds the receipt.
        </p>

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className={SHEET_CANCEL_BUTTON_CLASS}
          >
            Not now
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="bg-primary flex flex-1 items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition"
          >
            Got it, pay now
          </button>
        </div>
      </div>
    </LocalDialog>
  );
}
