"use client";

import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { WalletScreen } from "@/components/consumer/wallet/WalletScreen";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Redeem a gift code — PARKED (MESITA-1674).
//
// Redeem only ever had a code to claim against because Gift could issue one
// on the browser emulator (src/lib/mock/*, deleted this issue). With Gift
// parked until its real backend lands (MESITA-1677), there is no code this
// screen could ever validate — a live PIN field here would accept ten
// digits and always say "we don't know that code", which is worse than
// admitting the whole mechanic isn't wired yet.
//
// THE ROUTE STAYS LIVE, same reasoning as GiftClient.tsx: `/new-visit/wallet/
// redeem` keeps resolving so nothing 404s, including the `/inbox/credits`
// redirect and any code shared before this landed.
export function RedeemClient() {
  return (
    <WalletScreen title="Redeem Credits">
      <EmptyState
        icon={Wallet}
        title="Redeeming is coming soon"
        description="Claiming a gifted balance is being rebuilt on the real Credits ledger. Check back shortly."
        action={{
          label: "Back to Wallet",
          href: CONSUMER_ROUTES.newVisit.wallet,
        }}
      />
    </WalletScreen>
  );
}
