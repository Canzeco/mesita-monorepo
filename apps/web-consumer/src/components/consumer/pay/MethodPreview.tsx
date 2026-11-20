"use client";

import { useState } from "react";
import { brandLabel, type SavedCard } from "@/lib/api/cards";
import { openAddCardModal } from "@/lib/added-card";
import { methodFace } from "@/lib/pay-wallet";
import { Skeleton } from "@/components/shared/Skeleton";
import { MethodSheet, type Method } from "@/components/consumer/wallet/MethodSheet";
import { useWallet } from "@/components/consumer/wallet/use-wallet";

/** The saved card in the Wallet header. A failed read ends on Retry. */
export function MethodPreview() {
  const { wallet, failed, reread } = useWallet({ withCards: true });
  const [method, setMethod] = useState<Method | null>(null);
  const cards = failed ? null : wallet === null ? undefined : wallet.cards;
  const face = methodFace(cards);
  const card = face === "card" ? (cards as SavedCard[])[0] : null;
  const label = card ? `${brandLabel(card.brand)} •• ${card.last4}` : face === "add" ? "Add card" : "Retry";

  return (
    <>
      {face === "bone" ? (
        <Skeleton className="h-11 w-28 rounded-xl" aria-hidden />
      ) : (
        <button
          type="button"
          className="bg-foreground/15 text-foreground h-11 max-w-[42%] truncate rounded-xl px-3 text-sm"
          aria-label={face === "retry" ? "Couldn't load your saved cards. Tap Retry." : label}
          onClick={() => {
            if (card) setMethod({ kind: "card", card });
            else if (face === "add") openAddCardModal(() => reread());
            else reread();
          }}
        >
          {label}
        </button>
      )}
      <MethodSheet method={method} onClose={() => setMethod(null)} />
    </>
  );
}
