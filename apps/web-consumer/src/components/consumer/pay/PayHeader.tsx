import Link from "next/link";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";

// PAY | WALLET, NO SECTION HEADER (Pato, 2026-11-11, MESITA-3729: "at the
// button divide into Pay and Wallet. no header. i mean, not header with
// section name"): the top of /pay and /wallet is one switch, two equal halves
// on a white strip, the chosen one bold over a black bar the half's full
// width: the same band as Home's Places · Social (one mark everywhere). It
// replaced the "Pay" title with a Wallet button (MESITA-3726). MESITA-3698
// had this band under a "Pay" title; MESITA-3720 drew both on one page.

export const PAY_WALLET_TABS = [
  { key: "pay", label: "Pay", href: CONSUMER_ROUTES.pay },
  { key: "wallet", label: "Wallet", href: CONSUMER_ROUTES.wallet },
] as const;
export type PayWalletTab = (typeof PAY_WALLET_TABS)[number]["key"];

/** The Pay | Wallet switch, held at the top of the scroller. `-mx-4`
 *  because both pages pad their scroller by 1rem. */
export function PayHeader({ tab }: { tab: PayWalletTab }) {
  return (
    <nav aria-label="Pay" className="border-border bg-card sticky top-0 z-10 -mx-4 flex border-b pt-2" data-pay-wallet-tabs>
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
              "relative flex min-h-11 flex-1 items-center justify-center py-3 text-center text-base transition",
              on ? "text-foreground font-semibold" : "text-muted-foreground",
            )}
          >
            {on ? <span aria-hidden className="bg-foreground absolute inset-x-0 bottom-0 h-0.5" /> : null}
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
