"use client";

import { BalanceCard, CARD_PX } from "./BalanceCard";
import type { CreditOrgBalance } from "@/lib/api/credits";

// The balances, as a list of cards — one per ORGANIZATION now
// (consumer-web-list-credit-balances, MESITA-1674).
//
// RANKING LIVES ON THE SERVER, NOT HERE. rankOrgBalances
// (_shared/credits-balances.ts) already orders every page it hands back —
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
  balances: CreditOrgBalance[];
  nowMs: number;
  onOpen: (balance: CreditOrgBalance) => void;
}) {
  return (
    <ul className="flex w-full flex-col gap-3">
      {balances.map((balance) => (
        <li key={balance.organizationId}>
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
