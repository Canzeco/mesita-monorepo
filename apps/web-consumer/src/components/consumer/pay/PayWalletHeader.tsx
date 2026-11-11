import Link from "next/link";
import { cn } from "@/lib/utils";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// PAY · WALLET (Pato, 2026-11-11, MESITA-3698: "Divide Payments across two
// sections: Pay and Wallet"). The bar's Pay tab opens on two halves, each its
// own address: /pay (pay at a place: the payment in progress, Pay at a place)
// and /wallet (what you pay with: Money and Credits Payment Methods). The
// band under the header is Home's Places · Social band (CatalogRails): two
// equal halves on a white strip, the chosen one bold over a full-width black
// bar. The bar stays Home · Search · Pay · Activity · Me; Pay lights on both.
// MESITA-3631 had drawn the Wallet's rails under Pay's list on one page.

export const PAY_WALLET_TABS = [
  { key: "pay", label: "Pay", href: CONSUMER_ROUTES.pay },
  { key: "wallet", label: "Wallet", href: CONSUMER_ROUTES.wallet },
] as const;
export type PayWalletTab = (typeof PAY_WALLET_TABS)[number]["key"];

/** The white header bar, Pay, and the Pay · Wallet band, held at the top of
 *  the scroller. `-mx-4` because both pages pad their scroller by 1rem. */
export function PayWalletHeader({ tab }: { tab: PayWalletTab }) {
  return (
    <div className="sticky top-0 z-10 -mx-4" data-pay-wallet-header>
      <header className="bg-card flex min-h-[4.25rem] items-center px-4 pt-5 pb-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Pay</h1>
      </header>
      <nav aria-label="Pay" className="border-border bg-card flex border-y" data-pay-wallet-tabs>
        {PAY_WALLET_TABS.map((t) => {
          const on = tab === t.key;
          return (
            <Link
              key={t.key}
              href={t.href}
              replace
              scroll={false}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative flex-1 py-3 text-center text-sm transition",
                on ? "text-foreground font-semibold" : "text-muted-foreground",
              )}
            >
              {on ? <span aria-hidden className="bg-foreground absolute inset-x-0 bottom-0 h-0.5" /> : null}
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
