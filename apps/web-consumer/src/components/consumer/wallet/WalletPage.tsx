"use client";

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { PayHeader } from "../pay/PayHeader";
import { WalletSection } from "./WalletSection";
import { WalletShareGift } from "./WalletShareGift";
import { TicketsShortcut } from "../pay/TicketsShortcut";

// THE WALLET, /wallet, ITS OWN BAR TAB (Pato, 2026-11-14, MESITA-3886:
// "separate pay and wallet again. only pay and only wallet"): the title band
// (PayHeader) with the Tickets shortcut at its right (MESITA-3891), Share
// Mesita and Gift Credits (WalletShareGift), then what you
// pay with (WalletSection). It draws /wallet/gift/<token> too, with the
// friend's credit sheet over it. From MESITA-3729 until this it was the
// second half of a Pay | Wallet switch and lit Pay.
export function WalletPage({ giftToken = null }: { giftToken?: string | null }) {
  return (
    <KeptScroll className="scrollbar-hide bg-card flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8">
      <PayHeader title="Wallet" action={<TicketsShortcut />} />
      <WalletShareGift />
      <WalletSection giftToken={giftToken} />
    </KeptScroll>
  );
}
