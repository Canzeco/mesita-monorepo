import { BAR } from "@/components/consumer/search/header-classes";

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

/** The page's band, held at the top of its scroller: the title, and on Pay
 *  the search bar under it. `-mx-4` because both pages pad their scroller by
 *  1rem. */
export function PayHeader({
  title,
  bar,
}: {
  title: "Pay" | "Wallet";
  bar?: React.ReactNode;
}) {
  return (
    <div
      className="border-border bg-card sticky top-0 z-10 -mx-4 border-b px-4 pt-5 pb-4"
      data-page-band
    >
      <h1 className="font-display text-xl font-bold tracking-tight">{title}</h1>
      {bar ? (
        <div className="mt-3" data-pay-search>
          <div className={BAR}>{bar}</div>
        </div>
      ) : null}
    </div>
  );
}
