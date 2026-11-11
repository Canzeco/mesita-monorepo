import Link from "next/link";
import { QrCode, Wallet } from "lucide-react";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { BAR } from "@/components/consumer/search/header-classes";
import { cn } from "@/lib/utils";

// PAY | WALLET, NO SECTION HEADER (Pato, 2026-11-11, MESITA-3729: "at the
// button divide into Pay and Wallet. no header. i mean, not header with
// section name"): the top of /pay and /wallet is one switch, two equal halves
// on a white strip, the chosen one bold over a black bar the half's full
// width: the same band as Home's Places · Social (one mark everywhere). It
// replaced the "Pay" title with a Wallet button (MESITA-3726). MESITA-3698
// had this band under a "Pay" title; MESITA-3720 drew both on one page.
//
// ICONS AND A BLUE SELECTOR (Pato, MESITA-3730: "add icon to pay and to
// wallet on top and make selector blue and more visible"): Pay wears the
// bar's QR, Wallet a wallet; the chosen half is the app's selector blue
// (blue-600, as the catalog column and the place screen), label, icon and a
// 3px bar. Home's band stays ink (MESITA-3687).
//
// PAY'S SEARCH BAR IN THE BAND (Pato, MESITA-3738: "searchbar of different
// color or design"): on /pay the bar sits in the same white band, under the
// switch, as Search's grey pill (header-classes BAR); white on Pay's grey
// page it read like one more place row. It stays in view while the list
// scrolls. Wallet's band is the switch alone.

export const PAY_WALLET_TABS = [
  { key: "pay", label: "Pay", href: CONSUMER_ROUTES.pay, Icon: QrCode },
  {
    key: "wallet",
    label: "Wallet",
    href: CONSUMER_ROUTES.wallet,
    Icon: Wallet,
  },
] as const;
export type PayWalletTab = (typeof PAY_WALLET_TABS)[number]["key"];

/** The Pay | Wallet switch, held at the top of the scroller, and on Pay the
 *  search bar under it. `-mx-4` because both pages pad their scroller by 1rem. */
export function PayHeader({
  tab,
  bar,
}: {
  tab: PayWalletTab;
  bar?: React.ReactNode;
}) {
  return (
    <div className="border-border bg-card sticky top-0 z-10 -mx-4 border-b">
      <nav
        aria-label="Pay"
        className={cn("flex pt-2", bar ? "border-border border-b" : null)}
        data-pay-wallet-tabs
      >
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
                "relative flex min-h-11 flex-1 items-center justify-center gap-2 py-3 text-center text-base transition",
                on ? "font-semibold text-blue-600" : "text-muted-foreground",
              )}
            >
              {on ? (
                <span
                  aria-hidden
                  className="absolute inset-x-0 bottom-0 h-[3px] bg-blue-600"
                />
              ) : null}
              <t.Icon
                className="h-5 w-5"
                strokeWidth={on ? 2.25 : 1.75}
                aria-hidden
              />
              {t.label}
            </Link>
          );
        })}
      </nav>
      {bar ? (
        <div className="px-4 py-3" data-pay-search>
          <div className={BAR}>{bar}</div>
        </div>
      ) : null}
    </div>
  );
}
