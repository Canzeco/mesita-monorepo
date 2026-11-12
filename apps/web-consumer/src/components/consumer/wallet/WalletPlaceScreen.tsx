"use client";

import { Screen } from "@/components/consumer/nav/Screen";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Wallet as WalletIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { EFError } from "@/lib/api/_invoke";
import { apiRemoveHouseCard } from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { goBack, navigateTo } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { HouseCardSkeleton, PlaceCredit } from "./PlaceCredit";
import { useWallet } from "./use-wallet";

// /wallet/<placeId> — a place's House Card, full screen (MESITA-3533's
// sheet as a page, MESITA-3614). Reached from its card on the Wallet's
// Credits rail and straight from the place screen's Wallet tile, so the
// tile no longer lands on the Wallet and then pops a sheet. Back lands where
// the guest came from (goBack), or on the Wallet when opened from outside.
// A place the Wallet holds no card for sends the guest to the Wallet. A
// voucher bought at the place comes back here from Stripe (?prepay=,
// MESITA-3617), so the new credit shows on its own card. On white, like the
// Wallet it opens from (MESITA-3747).

export function WalletPlaceScreen({ placeId }: { placeId: string }) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const { wallet, failed, credits, reread, confirming } = useWallet();
  const row = credits?.find((r) => r.placeId === placeId) ?? null;
  const back = useCallback(() => goBack(router), [router]);

  // No House Card here: the Wallet is the nearest true screen. Not while a
  // purchase here is still confirming: a first one brings the card with it
  // (MESITA-3617).
  useEffect(() => {
    if (credits && !row && !confirming) navigateTo(router, CONSUMER_ROUTES.wallet, { replace: true });
  }, [credits, row, confirming, router]);

  // Remove from Wallet (MESITA-3605): a pinned $0 House Card leaves, and so
  // does its page.
  const removeHouseCard = useCallback(
    async (id: string) => {
      try {
        await apiRemoveHouseCard(getSupabase(), id);
        toast.success("Removed from Wallet.");
        back();
      } catch (err) {
        const code = err instanceof EFError ? err.code : null;
        toast.error(code === "has_credit" ? "This card has credit, so it stays in your Wallet." : "Couldn't remove it. Try again.");
        if (code === "has_credit") reread();
      }
    },
    [getSupabase, back, reread],
  );

  const sentLinks = row
    ? (wallet?.sent_links ?? []).filter((l) => l.place_id === row.placeId && l.currency === row.card.currency)
    : [];

  return (
    <Screen title={row?.card.name ?? "Wallet"} onBack={back} flush paper scrolls>
      <div className="flex flex-1 flex-col px-4 pt-5 pb-8">
        {confirming ? (
          <p className="text-muted-foreground mb-3 text-sm" role="status">
            Confirming a payment…
          </p>
        ) : null}
        {row ? (
          <PlaceCredit
            row={row}
            canSend={wallet?.can_send === true}
            sentLinks={sentLinks}
            stories={(wallet?.waiting_stories ?? []).filter((s) => s.place_id === row.placeId)}
            onReread={reread}
            onRemove={removeHouseCard}
          />
        ) : failed ? (
          <EmptyState
            icon={WalletIcon}
            title="Couldn't load your credit"
            description="Check your connection and try again."
            action={{ label: "Try again", onClick: reread }}
          />
        ) : (
          <HouseCardSkeleton />
        )}
      </div>
    </Screen>
  );
}
