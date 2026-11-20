"use client";

import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { brandLabel, type SavedCard } from "@/lib/api/cards";
import { openAddCardModal } from "@/lib/added-card";
import { methodFace } from "@/lib/pay-wallet";
import { Skeleton } from "@/components/shared/Skeleton";
import { useWallet } from "@/components/consumer/wallet/use-wallet";
import { navigateTo } from "@/lib/navigate";
import { walletCardPath } from "@/lib/consumer-route-contract";
import { PILL } from "./header-pill";

/** The saved card in the Wallet header. A failed read ends on Retry.
 *  The card itself is a page (MESITA-4112). A 40px grey pill, the card
 *  glyph and the last four, Tickets' twin (MESITA-4497). */
export function MethodPreview() {
  const router = useRouter();
  const { wallet, failed, reread } = useWallet({ withCards: true });
  const cards = failed ? null : wallet === null ? undefined : wallet.cards;
  const face = methodFace(cards);
  const card = face === "card" ? (cards as SavedCard[])[0] : null;
  const label = card ? card.last4 : face === "add" ? "Add card" : "Retry";

  return face === "bone" ? (
    <Skeleton className="h-10 w-20 rounded-xl" aria-hidden />
  ) : (
    <button
      type="button"
      className={PILL}
      aria-label={card ? `Payment card, ${brandLabel(card.brand)} ending in ${card.last4}` : face === "retry" ? "Couldn't load your saved cards. Tap Retry." : label}
      onClick={() => {
        if (card) navigateTo(router, walletCardPath(card.id), { motion: "drill" });
        else if (face === "add") openAddCardModal(() => reread());
        else reread();
      }}
    >
      <CreditCard className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="truncate tabular-nums">{label}</span>
    </button>
  );
}
