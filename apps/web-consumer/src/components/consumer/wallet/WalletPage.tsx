"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { PayHeader } from "../pay/PayHeader";
import { WalletSection } from "./WalletSection";

// THE WALLET TAB, /wallet (Pato, 2026-11-11, MESITA-3722: "return wallet as
// a different page. Pay and Wallet. Home Search Pay Wallet Me"): the white
// header bar reading Wallet, then what you pay with (WalletSection): the
// TestBand, Money Payment Methods and Credits Payment Methods. It draws
// /wallet/gift/<token> too, with the friend's credit sheet over it. Pay
// (/pay) is the places; MESITA-3720 had drawn this under them.
export function WalletPage({ giftToken = null }: { giftToken?: string | null }) {
  return (
    <KeptScroll className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8">
      <PayHeader title="Wallet" />
      <WalletSection giftToken={giftToken} />
    </KeptScroll>
  );
}
