"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { PayHeader } from "../pay/PayHeader";
import { WalletSection } from "./WalletSection";

// THE WALLET, /wallet: THE SWITCH'S SECOND HALF (Pato, 2026-11-11,
// MESITA-3729: "divide into Pay and Wallet. no header"): the Pay | Wallet
// switch at the top (PayHeader), then what you pay with (WalletSection): the
// Credits Payment Methods, then Money Payment Methods (MESITA-3731). It lights Pay and has no
// Back. It draws /wallet/gift/<token> too, with the friend's credit sheet over
// it. It was a page pushed from a Wallet button on Pay's header (MESITA-3726)
// and a bar tab for MESITA-3722.
export function WalletPage({ giftToken = null }: { giftToken?: string | null }) {
  return (
    <KeptScroll className="scrollbar-hide bg-card flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8">
      <PayHeader tab="wallet" />
      <WalletSection giftToken={giftToken} />
    </KeptScroll>
  );
}
