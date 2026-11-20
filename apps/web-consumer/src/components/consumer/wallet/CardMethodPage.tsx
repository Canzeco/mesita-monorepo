"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Screen } from "@/components/consumer/nav/Screen";
import { EFError } from "@/lib/api/_invoke";
import { apiRemoveCard, CARD_REFUSAL, type SavedCard } from "@/lib/api/cards";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { goBack } from "@/lib/navigate";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { CardBody } from "./MethodSheet";
import { useWallet } from "./use-wallet";

/** /wallet/cards/<id> — one saved card (MESITA-4112). Remove goes back to Pay. */
export function CardMethodPage({ cardId }: { cardId: string }) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const { wallet, failed, reread } = useWallet({ withCards: true });
  const [gone, setGone] = useState(false);
  const card = (wallet?.cards ?? []).find((c) => c.id === cardId) ?? null;

  async function remove(saved: SavedCard) {
    try {
      await apiRemoveCard(getSupabase(), saved.id);
      toast.success("Card removed.");
      setGone(true);
      reread();
      goBack(router, CONSUMER_ROUTES.pay);
    } catch (err) {
      const code = err instanceof EFError ? err.code : null;
      toast.error((code && CARD_REFUSAL[code]) || "Something went wrong. Try again.");
    }
  }

  const missing = gone || failed || (wallet !== null && wallet.cards !== null && !card);
  return (
    <Screen title={card ? `•••• ${card.last4}` : "Card"} paper scrolls>
      <div className="px-4 pt-5 pb-8">
        {card ? <CardBody card={card} onRemove={remove} /> : null}
        {missing ? <p className="text-muted-foreground text-sm">This card is not on your account.</p> : null}
        {!wallet && !failed ? <p className="text-muted-foreground text-sm">Opening your card…</p> : null}
      </div>
    </Screen>
  );
}
