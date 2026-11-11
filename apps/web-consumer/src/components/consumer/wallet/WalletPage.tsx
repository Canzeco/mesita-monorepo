"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { PayWalletHeader } from "../pay/PayWalletHeader";
import { WalletSection } from "./WalletSection";

// /wallet, THE PAY TAB'S SECOND HALF (Pato, 2026-11-11, MESITA-3698):
// the Pay · Wallet band, then the Wallet's two rails (WalletSection). It
// draws /wallet/gift/<token> too, with the friend's credit sheet over it.
export function WalletPage({ giftToken = null }: { giftToken?: string | null }) {
  return (
    <KeptScroll className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8">
      <PayWalletHeader tab="wallet" />
      <WalletSection giftToken={giftToken} />
    </KeptScroll>
  );
}
