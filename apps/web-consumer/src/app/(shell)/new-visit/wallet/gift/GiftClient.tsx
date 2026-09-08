"use client";

import { Gift } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { WalletScreen } from "@/components/consumer/wallet/WalletScreen";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// Gift Credits — PARKED (MESITA-1674).
//
// This screen ran a full purchase flow against the browser emulator
// (src/lib/mock/*) until this issue deleted that emulator: no import of it
// may survive anywhere in this package (the whole point of the deletion —
// two sources of truth for a balance is the bug this issue exists to kill).
// Gifting's real backend is MESITA-1677, a separate, still-in-flight issue —
// building it here would duplicate that work rather than wait for it, so
// this screen is parked instead of half-wired to nothing.
//
// THE ROUTE STAYS LIVE. `/new-visit/wallet/gift` keeps resolving — Wallet's
// own Gift button still links here — so nothing 404s; only the mechanic
// underneath is gone until MESITA-1677 replaces this file with a real one.
export function GiftClient() {
  return (
    <WalletScreen title="Gift Credits">
      <EmptyState
        icon={Gift}
        title="Gifting is coming soon"
        description="Buying Credits for someone else is being rebuilt on the real Credits ledger. Check back shortly."
        action={{
          label: "Back to Wallet",
          href: CONSUMER_ROUTES.newVisit.wallet,
        }}
      />
    </WalletScreen>
  );
}
