import type { ReactNode } from "react";

// Wallet's frame — a bottom tab of its own again (Pato, MESITA-2050: "Visit.
// Order. Wallet. Me."). No rail: Pato gave Wallet no pills, and the list plus
// its four full-screen children (Buy, Gift, Redeem, one balance) is the whole
// tab. The bottom bar's lit Wallet tab is the only "where am I" it needs.
//
// `force-dynamic` LIVES HERE, not on the pages. Every page below reads
// per-guest state, and a page's own route config covers that page only, never
// its children — Wallet was uncovered for four days the first time it lived
// under a layout that did not declare it (2026-09-05). One declaration on the
// container covers the container.
//
// Flex column, not a block — the wallet stack asks for `min-h-0 flex-1`.
export const dynamic = "force-dynamic";

export default function WalletLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {children}
    </div>
  );
}
