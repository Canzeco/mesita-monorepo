"use client";

import { useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, CreditCard, Plus, Smartphone } from "lucide-react";
import { CardBrandChip } from "@/components/shared/card-brand-marks";
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
export function MethodPreview({ wide = false, row = false }: { wide?: boolean; row?: boolean } = {}) {
  const router = useRouter();
  const applePhone = useApplePhone();
  const { wallet, failed, reread } = useWallet({ withCards: true });
  const cards = failed ? null : wallet === null ? undefined : wallet.cards;
  const face = methodFace(cards);
  const way = face === "card" || face === "add" ? defaultMethod(wallet?.pay_method, cards as SavedCard[], applePhone, readLastCard()) : null;

  if (face === "bone") {
    if (row)
      return (
        <span className="flex h-14 items-center gap-3 px-3" aria-hidden>
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-4 w-28 rounded" />
        </span>
      );
    return <Skeleton className={wide ? "h-12 min-w-0 flex-1 rounded-xl" : "h-10 w-20 rounded-xl"} aria-hidden />;
  }

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
  const open = () => {
    if (face === "retry") reread();
    else navigateTo(router, walletMethodsPath(), { motion: "drill" });
  };

  // ONE ROW IN PAY'S PAYMENT METHOD BOX (MESITA-4560, /plan-design-review
  // D4): the glyph, "Visa ••4242" (or Apple Pay, Add card, Retry), a ›.
  if (row) {
    const rowLabel = face !== "retry" && way?.kind === "card" ? `${brandLabel(way.card.brand)} ••${way.card.last4}` : label;
    return (
      <button type="button" className="hover:bg-muted/60 flex h-14 w-full items-center gap-3 px-3 text-left" aria-label={aria} onClick={open} data-pay-method>
        {/* THE CARD IN MINIATURE (Pato, 2026-11-21, MESITA-4561: "add some
            pseudo icon to the card or something"): a saved card wears its
            brand chip, the Payment methods page's own (official mark on the
            brand's colour); Apple Pay, Google Pay, Add card and Retry a grey
            chip of the same size with a glyph. A bare line icon before. */}
        {face !== "retry" && way?.kind === "card" ? (
          <CardBrandChip brand={way.card.brand} last4={way.card.last4} />
        ) : (
          <span className="bg-muted text-foreground flex h-8 w-[3.2rem] shrink-0 items-center justify-center rounded-md" aria-hidden>
            {way ? <Icon className="h-4 w-4" strokeWidth={2} /> : <Plus className="h-4 w-4" strokeWidth={2.25} />}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate text-base font-semibold tabular-nums">{rowLabel}</span>
        <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
      </button>
    );
  }

  return (
    <button
      type="button"
      className={wide ? WIDE : PILL}
      aria-label={aria}
      onClick={open}
    >
      <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="truncate tabular-nums">{label}</span>
    </button>
  );
}
