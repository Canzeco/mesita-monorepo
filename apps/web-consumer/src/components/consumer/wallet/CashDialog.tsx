"use client";

import { Banknote, X } from "lucide-react";

import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";

// CASH OR TERMINAL, A QUICK NOTE (Pato, 2026-11-18, MESITA-4382: "wtf is
// this ugly ass page. Maybe not even a page, just a quick modal explaining
// cash or terminal paying, like when you pay outside the Mesita app"): the
// Wallet's Cash tile opens this centred dialog in Add a Loyalty Card's shape
// (MESITA-4088), not a full page. Closes on the X, the backdrop, Escape and
// Close; 16px on every side.
export function CashDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <LocalDialog open={open} onClose={onClose} ariaLabel="Cash or terminal">
      <div data-cash-dialog>
        <div className="flex items-start gap-3 p-4">
          <span className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-full" aria-hidden>
            <Banknote className="h-5 w-5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-base font-semibold tracking-tight">Cash or terminal</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Pay the place directly with cash or its card terminal, outside the Mesita app.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="hover:bg-muted -m-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="border-border border-t p-4">
          <button
            type="button"
            onClick={onClose}
            className="bg-foreground text-paper flex h-11 w-full items-center justify-center rounded-xl text-sm font-semibold transition hover:opacity-90"
          >
            Got it
          </button>
        </div>
      </div>
    </LocalDialog>
  );
}
