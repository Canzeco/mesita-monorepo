"use client";

import { useState, type ReactNode } from "react";
import { Screen } from "@/components/consumer/nav/Screen";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { Skeleton } from "@/components/shared/Skeleton";
import { useApplePhone } from "@/components/consumer/pay/MethodPreview";
import { ApplePayChip, GooglePayChip } from "@/components/consumer/pay/wallet-chips";
import { apiSetPayMethod, brandLabel, expiryLabel, isExpired, MAX_SAVED_CARDS, type PayMethod, type SavedCard } from "@/lib/api/cards";
import { openAddCardModal } from "@/lib/added-card";
import { walletCardPath } from "@/lib/consumer-route-contract";
import { readLastCard } from "@/lib/guest-pay-draft";
import { defaultCard, defaultMethod, walletInBrowser } from "@/lib/pay-wallet";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { SavedCardChip, WALLET_PANEL, WALLET_ROWS } from "./WalletLists";
import { SECONDARY } from "./wallet-buttons";
import { useWallet } from "./use-wallet";

// PAYMENT METHODS (MESITA-4526, Pato 2026-11-21: "when i click the card or
// payment method button i must open a page displaying all my saved payment
// methods, including apple pay and google pay, and i can add or remove
// methods and select which one is the default"). One panel of rows: the
// saved card(s), Apple Pay, Google Pay. The default card, Apple Pay and
// Google Pay each carry a radio; the checked one is lib/pay-wallet's
// defaultMethod, the same answer the header and checkout use. A card's row
// opens its own page, where Remove is. Add card shows under the one-card
// limit (MESITA-4168). Apple Pay and Google Pay are the phone's own wallets:
// nothing to add or remove, only "In this browser" or not.

const ROW = "flex min-h-16 w-full items-center gap-3.5 px-4 py-3 text-left";

export function PaymentMethodsPage() {
  const getSupabase = useLazyBrowserSupabase();
  const applePhone = useApplePhone();
  const { wallet, failed, reread } = useWallet({ withCards: true });
  // The pick the guest just made, shown before the server answers.
  const [pending, setPending] = useState<PayMethod | null>(null);

  const cards = wallet?.cards ?? null;
  const loading = !failed && wallet === null;
  const cardsFailed = failed || (wallet !== null && wallet.cards === null);
  const stored = pending ?? wallet?.pay_method ?? null;
  const way = defaultMethod(stored, cards ?? [], applePhone, readLastCard());
  const checked: PayMethod | null = way === null ? null : way.kind;

  async function choose(next: PayMethod) {
    if (pending || checked === next) return;
    setPending(next);
    try {
      await apiSetPayMethod(getSupabase(), next);
      reread();
    } catch {
      toast.error("Couldn't save your default. Try again.");
    } finally {
      setPending(null);
    }
  }

  const rows: ReactNode[] = [];
  // Only the card checkout would charge takes the radio; older extra cards
  // and expired ones open their page and nothing else.
  const cardWithRadio = defaultCard(cards ?? [], readLastCard())?.id ?? null;
  for (const card of cards ?? []) {
    const expired = isExpired(card);
    const pickable = card.id === cardWithRadio;
    rows.push(
      <MethodRow
        key={card.id}
        chip={<SavedCardChip brand={card.brand} last4={card.last4} />}
        title={`${brandLabel(card.brand)} •••• ${card.last4}`}
        line={cardLine(card, expired)}
        href={walletCardPath(card.id)}
        radio={pickable ? { on: checked === "card", busy: pending !== null, onPick: () => void choose("card") } : null}
      />,
    );
  }
  for (const w of PHONE_WALLETS) {
    const here = walletInBrowser(w.key, applePhone);
    rows.push(
      <MethodRow
        key={w.key}
        chip={w.chip}
        title={w.title}
        line={here ? "In this browser" : "Not in this browser"}
        radio={here ? { on: checked === w.key, busy: pending !== null, onPick: () => void choose(w.key) } : null}
      />,
    );
  }

  return (
    <Screen title="Payment methods" paper scrolls>
      <div className="px-4 pt-3 pb-8">
        {loading ? (
          <div className={WALLET_PANEL} aria-hidden>
            {[0, 1, 2].map((i) => (
              <div key={i} className={ROW}>
                <Skeleton className="h-8 w-[3.2rem] rounded-md" />
                <Skeleton className="h-4 w-36" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {cardsFailed ? (
              <div className="border-border bg-card mt-2 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm">
                <span>Couldn&apos;t load your cards.</span>
                <button type="button" className="font-semibold underline" onClick={reread}>
                  Retry
                </button>
              </div>
            ) : null}
            <ul role="list" className={cn(WALLET_PANEL, WALLET_ROWS)} aria-label="Payment methods">
              {rows.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
            {!cardsFailed && (cards?.length ?? 0) < MAX_SAVED_CARDS ? (
              <button type="button" className={cn(SECONDARY, "mt-4")} onClick={() => openAddCardModal(() => reread())}>
                Add card
              </button>
            ) : null}
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              Your default is picked for you when you pay. Stripe keeps the card number; Mesita only sees the last four digits.
            </p>
          </>
        )}
      </div>
    </Screen>
  );
}

function cardLine(card: SavedCard, expired: boolean): string {
  if (expired) return "Expired";
  if (card.in_use) return `Expires ${expiryLabel(card)} · Pays your Premier plan`;
  return `Expires ${expiryLabel(card)}`;
}

const PHONE_WALLETS: { key: "apple_pay" | "google_pay"; title: string; chip: ReactNode }[] = [
  { key: "apple_pay", title: "Apple Pay", chip: <ApplePayChip /> },
  { key: "google_pay", title: "Google Pay", chip: <GooglePayChip /> },
];

function MethodRow({
  chip,
  title,
  line,
  href,
  radio,
}: {
  chip: ReactNode;
  title: string;
  line: string;
  href?: string;
  radio: { on: boolean; busy: boolean; onPick: () => void } | null;
}) {
  const body = (
    <>
      {chip}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base leading-tight font-semibold">{title}</span>
        <span className="text-muted-foreground mt-0.5 block truncate text-sm leading-tight">
          {radio?.on ? <span className="text-foreground font-semibold">Default · </span> : null}
          {line}
        </span>
      </span>
    </>
  );
  return (
    <div className="flex items-center">
      {href ? (
        <PushLink href={href} className={cn(ROW, "hover:bg-muted/60 min-w-0 flex-1 transition")}>
          {body}
        </PushLink>
      ) : (
        <div className={cn(ROW, "min-w-0 flex-1")}>{body}</div>
      )}
      {radio ? (
        <button
          type="button"
          role="radio"
          aria-checked={radio.on}
          aria-label={`Make ${title} your default`}
          disabled={radio.busy}
          onClick={radio.onPick}
          className="flex h-16 w-14 shrink-0 items-center justify-center"
        >
          <span
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full border-2",
              radio.on ? "border-foreground" : "border-muted-foreground/50",
            )}
            aria-hidden
          >
            {radio.on ? <span className="bg-foreground h-3 w-3 rounded-full" /> : null}
          </span>
        </button>
      ) : null}
    </div>
  );
}
