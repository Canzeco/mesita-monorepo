"use client";

// /me/gift — Me's Gift tile (MESITA-3771, Pato: "Me must only have Profile,
// Instagram, Class, Plan, Share, Gift, Settings"). Credit is held per place,
// so gifting starts by picking the place: the House Cards the guest holds
// money at, as the Wallet draws them. A tap opens that card's Send Gift page
// (MESITA-4096; it opened the House Card's sheet). Nothing held: one empty state
// that sends the guest to find a place.

import { Gift } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { CreditsRow, RowsSkeleton, WalletPanelList } from "@/components/consumer/wallet/WalletLists";
import { useWallet } from "@/components/consumer/wallet/use-wallet";
import { CONSUMER_ROUTES, walletSendPath } from "@/lib/consumer-route-contract";

export function GiftModal() {
  const { credits, failed, reread } = useWallet();
  const giftable = credits?.filter((r) => (r.balance?.spendable_cents ?? 0) > 0) ?? null;
  return (
    <MeScreen title="Gift">
      {giftable === null && failed ? (
        <EmptyState
          icon={Gift}
          title="Couldn't load your credit"
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: reread }}
        />
      ) : giftable === null ? (
        <WalletPanelList title="Your credit">
          <RowsSkeleton count={2} />
        </WalletPanelList>
      ) : giftable.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="Nothing to gift yet"
          action={{ label: "Find a place", href: CONSUMER_ROUTES.search }}
        />
      ) : (
        <WalletPanelList title="Your credit">
          {giftable.map((r, i) => (
            <CreditsRow
              key={r.placeId}
              card={r.card}
              href={walletSendPath(r.placeId)}
              eager={i < 4}
            />
          ))}
        </WalletPanelList>
      )}
    </MeScreen>
  );
}
