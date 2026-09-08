"use client";

import { BalanceCard, CARD_PX } from "./BalanceCard";
import { isExpired, type CreditBalance } from "@/lib/mock/credits-mock";

// The balances, as a LIST of cards (Pato, 2026-09-08). This replaces the deck.
//
// THE DECK COULD NOT SURVIVE WHAT COMES NEXT, and that is why it goes — not
// because a list is prettier. Three things break it at once:
//
//   · ORG SCOPE. A balance is about to belong to an ORGANIZATION, not a place.
//     `BalanceCard`'s art is the place's own `photos[0]`, and the carve-out
//     that let a photo face exist at all survived review specifically because
//     the photo is the place's own — picking one place's photo to stand for
//     twenty is the "inventing brand identity" objection the rule was written
//     against.
//   · PENDING LOTS. The hold returns (MESITA-1671) with one countdown per
//     purchase, so one card must state several maturities. That does not fit
//     in a 96px peek.
//   · TWENTY BALANCES. A deck of twenty overlapping photos is 1900px of pile
//     with no search and no total.
//
// KILL THE DECK, KEEP THE CARD. The overlap, the z-index, the reverse painting
// and the covered state are gone; `BalanceCard` itself is untouched and is
// mounted uncovered. Everything the deck was praised for is IN the card — the
// scrims are computed against a pure-white worst case so white text clears AA
// on any photo that can exist, and the balance is set in the display face
// because brand.json assigns it to numerals in hero positions. A row of text
// would have thrown all of that away on the one screen that asks a guest to
// pay before they eat, and a prepaid balance is a trust instrument: the visual
// weight IS the trust.
//
// NORMAL FLOW, REAL GAPS. No negative margins, nothing measured, nothing
// computed. Each card sizes to its own content, so at 200% text a long name
// makes its own card taller instead of clipping.
//
// DOM ORDER IS VISUAL ORDER, and now trivially so: there is no pile, so
// nothing needs painting out of order to sit in front.

/**
 * List order: spendable money first, then dead money, and within each the
 * biggest balance.
 *
 * It used to be whatever order the fixture happened to be in, which is not an
 * order, it is an accident. Spendable-first is the only ranking a guest can
 * predict without being told, and it makes the one remaining rule demonstrate
 * itself: a balance sinks to the bottom the moment it expires. There used to
 * be a middle tier, money still inside its hold; it went when the hold did and
 * it comes back with MESITA-1671, ranking between the two.
 *
 * EXPIRED SINKS rather than being dropped. It is the one balance that will
 * never come back up, so it belongs at the bottom — but it is also the only
 * record the guest has that the money was ever there.
 */
export function rankBalances(
  balances: CreditBalance[],
  nowMs: number,
): CreditBalance[] {
  // 0 spendable · 1 expired.
  const rank = (b: CreditBalance) => (isExpired(b, nowMs) ? 1 : 0);
  return [...balances].sort((a, b) => {
    const byState = rank(a) - rank(b);
    if (byState !== 0) return byState;
    return b.balanceCents - a.balanceCents;
  });
}

export function BalanceList({
  balances,
  nowMs,
  onOpen,
}: {
  balances: CreditBalance[];
  nowMs: number;
  onOpen: (balance: CreditBalance) => void;
}) {
  return (
    <ul className="flex w-full flex-col gap-3">
      {rankBalances(balances, nowMs).map((balance) => (
        <li key={balance.id}>
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
