import type { ReactNode } from "react";
import { PaySectionNav } from "@/components/consumer/pay/PaySectionNav";

// Pay's shared frame: the section row, then New or Wallet.
//
// Flex column, not a block — the place list and the wallet stack both ask for
// `min-h-0 flex-1`, and a block parent makes that inert.
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
