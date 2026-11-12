"use client";

// /me/gift — Me's Gift tile (MESITA-3771, Pato: "Me must only have Profile,
// Instagram, Class, Plan, Share, Gift, Settings"). Credit is held per place,
// so gifting starts by picking the place: the House Cards the guest holds
// money at, as the Wallet draws them. A tap opens that House Card with its
// Gift Credits sheet already open (`?gift=1`). Nothing held: one empty state
// that sends the guest to find a place.

import { Gift } from "lucide-react";

import { MeScreen } from "@/components/consumer/me/MeScreen";
import { EmptyState } from "@/components/shared/EmptyState";
import { CreditsRow, RowsSkeleton, WalletList } from "@/components/consumer/wallet/WalletLists";
import { useWallet } from "@/components/consumer/wallet/use-wallet";
import { CONSUMER_ROUTES, walletPlacePath } from "@/lib/consumer-route-contract";

export function GiftModal() {
  const { credits, failed, reread } = useWallet();
  const giftable = credits?.filter((r) => (r.balance?.spendable_cents ?? 0) > 0) ?? null;
  return (
    <MeScreen title="Gift">
      <p className="text-muted-foreground px-1 text-sm">
        Send credit you hold at a place to a friend. Pick the place.
      </p>
      {giftable === null && failed ? (
        <EmptyState
          icon={Gift}
          title="Couldn't load your credit"
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: reread }}
        />
      ) : giftable === null ? (
        <WalletList title="Your credit">
          <RowsSkeleton count={2} />
        </WalletList>
      ) : giftable.length === 0 ? (
        <EmptyState
          icon={Gift}
          title="Nothing to gift yet"
          description="Buy credit at a place, then gift it from here."
          action={{ label: "Find a place", href: CONSUMER_ROUTES.search }}
        />
      ) : (
        <WalletList title="Your credit">
          {giftable.map((r, i) => (
            <CreditsRow
              key={r.placeId}
              card={r.card}
              href={`${walletPlacePath(r.placeId)}?gift=1`}
              eager={i < 4}
            />
          ))}
        </WalletList>
      )}
    </MeScreen>
  );
}
