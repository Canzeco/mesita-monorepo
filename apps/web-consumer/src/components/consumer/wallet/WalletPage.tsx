"use client";

import { Screen } from "@/components/consumer/nav/Screen";
import { WalletSection } from "./WalletSection";

// THE WALLET, /wallet: A PAGE INSIDE PAY (Pato, 2026-11-11, MESITA-3726:
// "Wallet va dentro de Pay"): pushed from the Wallet button on Pay's header,
// it wears the pushed-page frame (Screen) with Back and lights Pay. What you
// pay with (WalletSection): the TestBand, Money Payment Methods and Credits
// Payment Methods. It draws /wallet/gift/<token> too, with the friend's
// credit sheet over it. It was a bar tab for MESITA-3722, and drawn under
// Pay's places in MESITA-3720.
export function WalletPage({ giftToken = null }: { giftToken?: string | null }) {
  return (
    <Screen title="Wallet" flush>
      <div className="flex flex-col px-4 pb-8">
        <WalletSection giftToken={giftToken} />
      </div>
    </Screen>
  );
}
