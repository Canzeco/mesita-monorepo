"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, Smartphone } from "lucide-react";
import { brandLabel, type SavedCard } from "@/lib/api/cards";
import { defaultMethod, isApplePhone, methodFace } from "@/lib/pay-wallet";
import { readLastCard } from "@/lib/guest-pay-draft";
import { Skeleton } from "@/components/shared/Skeleton";
import { useWallet } from "@/components/consumer/wallet/use-wallet";
import { navigateTo } from "@/lib/navigate";
import { walletMethodsPath } from "@/lib/consumer-route-contract";
import { PILL, WIDE } from "./header-pill";

const noSubscribe = () => () => {};

/** Whether this browser is Apple's, read after hydration (false on the
 *  server, so the first paint never claims Apple Pay). */
export function useApplePhone(): boolean {
  return useSyncExternalStore(noSubscribe, isApplePhone, () => false);
}

/** The DEFAULT way to pay in the Wallet header (MESITA-4526; the saved card
 *  since MESITA-4112): the card's last four, or Apple Pay / Google Pay.
 *  It always opens Payment methods. A failed read ends on Retry. A 40px
 *  grey pill, Tickets' twin (MESITA-4497). */
export function MethodPreview({ wide = false }: { wide?: boolean } = {}) {
  const router = useRouter();
  const applePhone = useApplePhone();
  const { wallet, failed, reread } = useWallet({ withCards: true });
  const cards = failed ? null : wallet === null ? undefined : wallet.cards;
  const face = methodFace(cards);
  const way = face === "card" || face === "add" ? defaultMethod(wallet?.pay_method, cards as SavedCard[], applePhone, readLastCard()) : null;

  if (face === "bone") return <Skeleton className={wide ? "h-12 min-w-0 flex-1 rounded-xl" : "h-10 w-20 rounded-xl"} aria-hidden />;

  const label =
    face === "retry"
      ? "Retry"
      : way?.kind === "card"
        ? way.card.last4
        : way?.kind === "apple_pay"
          ? "Apple Pay"
          : way?.kind === "google_pay"
            ? "Google Pay"
            : // "Add card" (Pato, 2026-11-21, MESITA-4533): "Add payment
              // method" cut to "Add payment me…" in the half-width button at
              // 390px. The aria-label keeps the full words.
              "Add card";
  const aria =
    face === "retry"
      ? "Couldn't load your payment methods. Tap Retry."
      : way?.kind === "card"
        ? `Payment methods. Default: ${brandLabel(way.card.brand)} ending in ${way.card.last4}`
        : way
          ? `Payment methods. Default: ${label}`
          : "Add a payment method";
  const Icon = way && way.kind !== "card" ? Smartphone : CreditCard;

  return (
    <button
      type="button"
      className={wide ? WIDE : PILL}
      aria-label={aria}
      onClick={() => {
        if (face === "retry") reread();
        else navigateTo(router, walletMethodsPath(), { motion: "drill" });
      }}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="truncate tabular-nums">{label}</span>
    </button>
  );
}
