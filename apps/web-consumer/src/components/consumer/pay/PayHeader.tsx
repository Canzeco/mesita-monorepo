import { BAR } from "@/components/consumer/search/header-classes";
import type { ReactNode } from "react";

// PAY AND WALLET, EACH ITS OWN PAGE (Pato, 2026-11-14, MESITA-3886:
// "separate pay and wallet again. only pay and only wallet"): the top of
// /pay and of /wallet is a white band with the page's title, the band the
// Share page wears; on Pay the search bar sits under the title. It was a
// Pay | Wallet switch on that band (MESITA-3729/3730), the chosen half blue.
//
// PAY'S SEARCH BAR IN THE BAND (Pato, MESITA-3738: "searchbar of different
// color or design"): the same white band, as Search's grey pill (header-classes
// BAR); white on Pay's grey page it read like one more place row. It stays in
// view while the list scrolls.

/** The page's band, held at the top of its scroller: the title, a control
 *  at its right (the Tickets shortcut, MESITA-3891), and on Pay the search
 *  bar under a hairline (Pato, MESITA-3891: "add a line dividing the
 *  searchbar and pay"). `-mx-4` because both pages pad their scroller by
 *  1rem.
 *
 *  SHORT (Pato, 2026-11-15, MESITA-4087: "make page header shorter"): 52px
 *  (8px over and under a 36px Tickets pill, the title one step down at
 *  text-lg); it was ~76px (pt-5 pb-4, text-xl). Pay's search row 8px too. */
export function PayHeader({
  title,
  action,
  bar,
}: {
  title: "Pay" | "Wallet";
  action?: ReactNode;
  bar?: ReactNode;
}) {
  return (
    <div
      className="border-border bg-card sticky top-0 z-10 -mx-4 border-b"
      data-page-band
    >
      <div className="flex min-h-9 items-center justify-between gap-3 px-4 py-2">
        <h1 className="font-display text-lg font-bold tracking-tight">{title}</h1>
        {action}
      </div>
      {bar ? (
        <div className="border-border border-t px-4 py-2" data-pay-search>
          <div className={BAR}>{bar}</div>
        </div>
      ) : null}
    </div>
  );
}
