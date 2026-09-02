"use client";

import { BalanceCard, CARD_PX, PEEK_PX } from "./BalanceCard";
import {
  isExpired,
  isLocked,
  type CreditBalance,
} from "@/lib/mock/credits-mock";

// The card deck.
//
// ONE STATE (2026-09-02 design review). It used to have two: a collapsed deck
// and a "spread" that fanned every card apart. The spread existed to reveal the
// balance on buried cards, and it never did — it uncovered 120px of a 176px
// card, so it revealed the TOP HALF OF A NUMBER, sliced by the next card's
// edge. Widening the spread until it cleared the card turned the open state
// into a plain list of pictures, which is the row-list this deck exists to stop
// being. So the second state is gone: the peek is deep enough (96px) that every
// card states its own name and balance at rest, and a tap opens that balance
// instead of rearranging the furniture. A partial reveal cannot slice anything
// if there is no partial reveal.
//
// TAP ONLY, on purpose, and that constraint is older than this rewrite. A
// vertical drag on an overlapping deck inside a vertical scroller is the
// textbook gesture conflict — the browser claims the drag for scroll after
// about ten pixels. The one gesture stack this repo owns (home/swipe/SwipeDeck)
// solves that by locking the HORIZONTAL axis and explicitly ignoring vertical,
// so it is not reusable here even before you notice it is parked code coupled
// to the router. So: no pointer handlers, and no `touch-none` either — killing
// browser panning to support a gesture that does not exist is a pure
// regression. It is also why Apple's drag-to-reorder is not on the table, and
// therefore why the order below has to be computed rather than chosen.
//
// NORMAL FLOW, NEGATIVE MARGINS — NOT ABSOLUTE POSITIONING. The old deck placed
// every card with `translateY(i * offset)` inside a container whose height it
// computed, which meant the geometry had to be known before render: three
// constants that had to agree, and the sliced balance was them disagreeing. In
// flow, each card sizes to its own content and the next one simply overlaps it
// by `OVERLAP_PX`. Nothing is measured, nothing is computed, and at 200% text a
// long place name makes its own card taller instead of clipping — the CSS does
// what a ResizeObserver would have been written to do.
//
// DOM ORDER IS VISUAL ORDER. Painting the front card last would put it last in
// tab order and announce the bottom of the pile first, so depth comes from an
// explicit z-index instead.

// Enough to tuck the previous card's bottom corners under the next one. Any
// more and the deck reads as a list; any less and the radius floats.
const OVERLAP_PX = 18;

/**
 * Deck order: spendable money first, then waiting money, then dead money, and
 * within each the biggest balance.
 *
 * It used to be whatever order the fixture happened to be in, which is not an
 * order, it is an accident. Spendable-first is the only ranking a guest can
 * predict without being told, and it makes both rules demonstrate themselves: a
 * card visibly climbs the deck the moment its hold lifts and sinks to the back
 * the moment it expires, which is exactly what the demo clock is there to show.
 *
 * EXPIRED SINKS BELOW LOCKED rather than being dropped. It is the one card that
 * will never come back up, so it belongs at the bottom — but it is also the
 * only record the guest has that the money was ever there.
 */
export function rankBalances(
  balances: CreditBalance[],
  nowMs: number,
): CreditBalance[] {
  // 0 spendable · 1 still inside its hold · 2 expired.
  const rank = (b: CreditBalance) =>
    isExpired(b, nowMs) ? 2 : isLocked(b, nowMs) ? 1 : 0;
  return [...balances].sort((a, b) => {
    const byState = rank(a) - rank(b);
    if (byState !== 0) return byState;
    return b.balanceCents - a.balanceCents;
  });
}

export function BalanceStack({
  balances,
  nowMs,
  onOpen,
}: {
  balances: CreditBalance[];
  nowMs: number;
  onOpen: (balance: CreditBalance) => void;
}) {
  // PAINTED IN REVERSE OF THE RANKING. In a deck the front card is the LOWEST
  // one — it is the card nothing else covers, and the only one that shows its
  // face. So rank 1 has to be painted last. Sorting without reversing puts the
  // least relevant balance in the one position that gets the big number.
  const painted = rankBalances(balances, nowMs).reverse();
  const front = painted.length - 1;

  return (
    <ul className="relative mx-auto flex w-full flex-col">
      {painted.map((balance, i) => (
        <li
          key={balance.id}
          className="relative"
          style={{ zIndex: i + 1, marginTop: i === 0 ? 0 : -OVERLAP_PX }}
        >
          <BalanceCard
            balance={balance}
            nowMs={nowMs}
            covered={i !== front}
            onSelect={() => onOpen(balance)}
            className={i === front ? "shadow-elev" : "shadow-rest"}
          />
        </li>
      ))}
    </ul>
  );
}

export { CARD_PX, PEEK_PX };
