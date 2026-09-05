import type { ReactNode } from "react";

// Wallet's frame. It has no section row and never will — Wallet is a TAB now
// (2026-09-05), not a section of one, so there is nothing to switch between.
// This layout exists for the two things the old Pay container was silently
// providing before Wallet moved out from under it:
//
//   1. `force-dynamic`. The deck reads per-guest state; the page it replaced
//      leaned on inbox/layout.tsx for this, then on nothing at all once it
//      moved under /new-visit, whose force-dynamic sits on the PAGE and so
//      never covered the child segment.
//   2. The flex column. BalanceStack asks for `min-h-0 flex-1`, which a block
//      parent makes inert — the deck collapses to its content height and the
//      rows under it stop sitting where the design puts them.
export const dynamic = "force-dynamic";

export default function WalletLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
