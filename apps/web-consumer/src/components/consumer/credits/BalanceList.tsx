"use client";

import { BalanceCard, CARD_PX } from "./BalanceCard";
import type { CreditPlaceBalance } from "@/lib/api/credits";

// The balances, as a list of cards — one per PLACE
// (consumer-web-list-credit-balances, MESITA-1674; org-scoped until
// MESITA-1892 made the place the only tenant).
//
// RANKING LIVES ON THE SERVER, NOT HERE. The ranker in
// _shared/credits-balances.ts already orders every page it hands back —
// spendable first, then pending, then dead money, ties broken by amount then
// name — and pagination is keyset over THAT order. A second, client-side sort
// would silently disagree with page boundaries the server already drew, so
// this component renders exactly the order it receives.
//
// KILL THE DECK, KEEP THE CARD (unchanged from the per-place redesign this
// inherits). No overlap, no z-index, nothing measured — each card sizes to
// its own content and DOM order is visual order.

export function BalanceList({
  balances,
  nowMs,
  onOpen,
}: {
  balances: CreditPlaceBalance[];
  nowMs: number;
  onOpen: (balance: CreditPlaceBalance) => void;
}) {
  return (
    <ul className="flex w-full flex-col gap-3">
      {balances.map((balance) => (
        <li key={balance.placeId}>
          <BalanceCard
            balance={balance}
            nowMs={nowMs}
            covered={false}
            onSelect={() => onOpen(balance)}
            className="shadow-rest"
          />
        </li>
      ))}
    </ul>
  );
}

export { CARD_PX };
