"use client";

import { useState } from "react";
import { BalanceCard, CARD_PX, PEEK_PX } from "./BalanceCard";
import type { CreditBalance } from "@/lib/mock/credits-mock";

// The card stack.
//
// TAP ONLY, on purpose. A vertical drag on an overlapping stack that lives
// inside a vertical scroller is the textbook gesture conflict — the browser
// claims the drag for scroll after about ten pixels and the fan stutters. The
// one gesture stack this repo owns (home/swipe/SwipeDeck) solves that by
// locking the HORIZONTAL axis and explicitly ignoring vertical, so it is not
// reusable here even before you notice it is parked code coupled to the router
// and the saved-places store. So: no pointer handlers, and no `touch-none`
// either — killing browser panning to support a gesture that does not exist
// would be a pure regression.
//
// TWO DISCRETE STATES, not a spring. This package has no animation library
// (`tw-animate-css` plus CSS transitions) and a 300ms ease-out fan is not a
// spring — it is a slideshow. A bad imitation of Apple Wallet reads worse than
// a deliberate thing that is not trying to be one. 300ms is the tempo
// LocalOverlay, SlideOverShell and BottomSheetShell already share, so the app
// keeps one clock.
//
// SPREAD_PX EXISTS TO REVEAL THE AMOUNT. The peek is 62px (identity + balance);
// spreading to 120px uncovers the big number and the terms line on every card
// at once, which is the whole reason the gesture is here. A smaller spread
// would buy empty gradient and make the tap pointless.
//
// DOM ORDER IS VISUAL ORDER. Painting the front card last would put it last in
// tab order and announce the bottom of the pile first, so depth comes from an
// explicit z-index instead.

const SPREAD_PX = 120;

export function BalanceStack({
  balances,
  nowMs,
  onOpen,
}: {
  balances: CreditBalance[];
  nowMs: number;
  onOpen: (balance: CreditBalance) => void;
}) {
  const [spread, setSpread] = useState(false);
  const offset = spread ? SPREAD_PX : PEEK_PX;
  const height = offset * (balances.length - 1) + CARD_PX;

  return (
    <ul
      className="relative mx-auto w-full transition-[height] duration-300 ease-out motion-reduce:transition-none"
      style={{ height }}
    >
      {balances.map((balance, i) => (
        <li key={balance.id}>
          <BalanceCard
            balance={balance}
            nowMs={nowMs}
            expanded={spread}
            // Collapsed, a tap spreads the stack so every card is readable.
            // Spread, a tap opens that balance. One control, two states.
            onSelect={() => (spread ? onOpen(balance) : setSpread(true))}
            className={
              i === balances.length - 1 ? "shadow-elev" : "shadow-rest"
            }
            style={{
              height: CARD_PX,
              zIndex: i + 1,
              transform: `translateY(${i * offset}px)`,
              // Capped so a long stack never waits on a long cascade.
              transitionDelay: `${Math.min(i, 3) * 30}ms`,
            }}
          />
        </li>
      ))}
    </ul>
  );
}
