import type { ReactNode } from "react";
import { PaySectionNav } from "@/components/consumer/pay/PaySectionNav";

// Pay's shared frame: the section row, then New or Wallet.
//
// Flex column, not a block — the place list and the wallet stack both ask for
// `min-h-0 flex-1`, and a block parent makes that inert.
//
// `force-dynamic` LIVES HERE, on the layout, not on the pages. Both sections
// read per-guest state, and new-visit/page.tsx's own declaration sits on the
// PAGE — a page's route config covers that page and nothing below it, so the
// Wallet child was uncovered for the four days it first lived here (found the
// hard way when Wallet moved to /wallet on 2026-09-05 and needed a layout of
// its own to get it back). One declaration on the container covers the
// container.
export const dynamic = "force-dynamic";

export default function NewVisitLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PaySectionNav />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
