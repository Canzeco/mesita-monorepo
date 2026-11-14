"use client";

import { CreditCard } from "lucide-react";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { brandLabel, expiryLabel, type SavedCard } from "@/lib/api/cards";

// HOW TO PAY FOR A VOUCHER (MESITA-3552). Buy on the Offers page opens this
// small sheet: each saved card is one tap that charges it on the place's own
// account (no Stripe page); "Stripe's page" is the Checkout as before; "Add
// a card" saves one on Stripe's page and comes back here. Every amount and
// every refusal is the server's. A basket of several vouchers (MESITA-3841)
// is one charge on a saved card: Stripe's page is not offered for it.

const ROW =
  "border-border bg-card hover:bg-muted flex min-h-14 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition disabled:opacity-50";
const QUIET =
  "border-border bg-card hover:bg-muted flex h-12 w-full items-center justify-center rounded-xl border text-sm font-semibold transition disabled:opacity-50";

export function VoucherPaySheet({
  open,
  title,
  cards,
  busy,
  checkoutAllowed = true,
  onCard,
  onCheckout,
  onAddCard,
  onClose,
}: {
  open: boolean;
  /** "$1,000MX voucher" — the server's price, formatted. */
  title: string;
  /** null while the saved cards load. */
  cards: SavedCard[] | null;
  busy: boolean;
  /** False for a basket of several vouchers: saved cards only (MESITA-3841). */
  checkoutAllowed?: boolean;
  onCard: (card: SavedCard) => void;
  onCheckout: () => void;
  onAddCard: () => void;
  onClose: () => void;
}) {
  return (
    <LocalSheet open={open} onClose={busy ? () => {} : onClose} ariaLabel="How to pay">
      <div className="px-4 pt-5 pb-8">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-muted-foreground mt-1 text-sm">How do you want to pay?</p>
        <div className="mt-4 flex flex-col gap-2" aria-busy={busy || cards === null}>
          {cards === null ? (
            <div className="bg-muted h-14 w-full animate-pulse rounded-xl" aria-hidden />
          ) : (
            cards.map((c) => (
              <button key={c.id} type="button" className={ROW} disabled={busy} onClick={() => onCard(c)}>
                <CreditCard className="h-5 w-5 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {brandLabel(c.brand)} •••• {c.last4}
                  </span>
                  <span className="text-muted-foreground block text-xs">Expires {expiryLabel(c)}</span>
                </span>
              </button>
            ))
          )}
          {checkoutAllowed ? (
            <button type="button" className={QUIET} disabled={busy} onClick={onCheckout}>
              Pay on Stripe&apos;s page
            </button>
          ) : (
            <p className="text-muted-foreground px-1 text-xs">Several vouchers are one charge on a saved card.</p>
          )}
          <button type="button" className={QUIET} disabled={busy} onClick={onAddCard}>
            Add a card
          </button>
        </div>
      </div>
    </LocalSheet>
  );
}
