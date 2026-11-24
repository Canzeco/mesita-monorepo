import { HOME_WORDMARK_CLASS } from "@/components/brand/home-wordmark";
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
 *  searchbar and pay"). `-mx-2` because the Wallet pads its scroller by
 *  8px (MESITA-4276); the title keeps its own 16px inset.
 *
 *  SHORT (Pato, 2026-11-15, MESITA-4087: "make page header shorter"): 52px
 *  (8px over and under a 36px Tickets pill, the title one step down at
 *  text-lg); it was ~76px (pt-5 pb-4, text-xl). Pay's search row 8px too. */
export function PayHeader({
  title,
  action,
  bar,
  embedded = false,
}: {
  title: "Pay" | "Wallet" | "Mesita";
  action?: ReactNode;
  bar?: ReactNode;
  /** Inside Wallet's dark slab (MESITA-4505). No sticky white band of its own. */
  embedded?: boolean;
}) {
  if (embedded) {
    return (
      <div className="flex min-h-9 items-center justify-between gap-3 px-2 py-2" data-page-band>
        <h1 className="text-background text-lg font-bold tracking-tight">{title}</h1>
        {action}
      </div>
    );
  }
  // THE APP'S OWN PAGE HEADER (Pato, 2026-11-21, MESITA-4525: "that header
  // looks like shit. call it Mesita Wallet … improve size"): Screen's shape,
  // 60px (8px over and under a 44px row), the title centred at 20px
  // semibold with the Mesita mark before it, a hairline under it. It was
  // 52px with an 18px bold title at the left (MESITA-4087).
  //
  // TITLE LEFT, TICKETS RIGHT (Pato, 2026-11-21, MESITA-4559: "Mesita
  // Wallet to the left, tickets to the right"): the title at the left edge,
  // the action at the right. Centred before (MESITA-4525). HOME'S WORDMARK
  // (Pato, 2026-11-24, MESITA-4830: "top left same icon logo as in home. i
  // like the one in home"), on Home's 16px inset; the mark and an Inter
  // "Mesita" under MESITA-4827, "Mesita Wallet" before it.
  return (
    <div
      className="border-border bg-card sticky top-0 z-10 -mx-2 border-b"
      data-page-band
    >
      {/* The title takes its own width and the action the rest, so Gift and
          Tickets have room between them (MESITA-4834). It was the tiles'
          50/50 grid (MESITA-4796). */}
      <div className={action ? "grid min-h-11 grid-cols-[auto_minmax(0,1fr)] items-center gap-2 px-2 py-2" : "flex min-h-11 items-center px-3 py-2"}>
        <h1 className="flex min-h-11 min-w-0 items-center pl-2 text-xl font-semibold tracking-tight">
          <span className={title === "Mesita" ? HOME_WORDMARK_CLASS : "min-w-0 truncate"}>{title}</span>
        </h1>
        {action ? <div className="min-w-0">{action}</div> : null}
      </div>
      {bar ? (
        <div className="border-border border-t px-4 py-2" data-pay-search>
          <div className={BAR}>{bar}</div>
        </div>
      ) : null}
    </div>
  );
}
