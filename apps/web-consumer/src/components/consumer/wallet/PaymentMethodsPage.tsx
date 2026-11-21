"use client";

import { useState, type ReactNode } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { LocalDialog } from "@/components/consumer/overlay/LocalOverlay";
import { EFError } from "@/lib/api/_invoke";
import { Screen } from "@/components/consumer/nav/Screen";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { Skeleton } from "@/components/shared/Skeleton";
import { useApplePhone } from "@/components/consumer/pay/MethodPreview";
import { ApplePayChip, GooglePayChip } from "@/components/consumer/pay/wallet-chips";
import { apiRemoveCard, apiSetPayMethod, brandLabel, CARD_REFUSAL, expiryLabel, isExpired, MAX_SAVED_CARDS, type PayMethod, type SavedCard } from "@/lib/api/cards";
import { openAddCardModal } from "@/lib/added-card";
import { walletCardPath } from "@/lib/consumer-route-contract";
import { readLastCard, writeLastCard } from "@/lib/guest-pay-draft";
import { defaultMethod, walletInBrowser } from "@/lib/pay-wallet";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { SavedCardChip, WALLET_PANEL, WALLET_ROWS } from "./WalletLists";
import { PRIMARY, SECONDARY } from "./wallet-buttons";
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
//
// ADD OR REMOVE ON THE PAGE (Pato, 2026-11-21, MESITA-4590: "enable to add or
// remove payment method in this page easy peasy. clean"; /autoplan, picked
// "Allow up to 3 cards"): every usable card carries its own radio (picking
// one makes it the default: pay_method "card" and this device's remembered
// card) and a trash button with a yes/no confirm; a card paying a Premier
// plan is refused with the reason. "Add card" is the panel's last row while
// fewer than 3 cards are saved. The card's own page stays for its details.

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
  const checkedCard = way?.kind === "card" ? way.card.id : null;
  // The card asked about in the Remove confirm, and the remove in flight.
  const [removing, setRemoving] = useState<SavedCard | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  async function remove(card: SavedCard) {
    setRemoveBusy(true);
    try {
      await apiRemoveCard(getSupabase(), card.id);
      toast.success("Card removed.");
      reread();
    } catch (err) {
      const code = err instanceof EFError ? err.code : null;
      toast.error((code && CARD_REFUSAL[code]) || "Couldn't remove the card. Try again.");
    } finally {
      setRemoveBusy(false);
      setRemoving(null);
    }
  }

  async function choose(next: PayMethod, cardId?: string) {
    if (pending || (checked === next && (next !== "card" || !cardId || cardId === checkedCard))) return;
    if (cardId) writeLastCard(cardId);
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
  // Every usable card takes a radio (MESITA-4590); an expired one opens its
  // page and can be removed, nothing else.
  for (const card of cards ?? []) {
    const expired = isExpired(card);
    rows.push(
      <MethodRow
        key={card.id}
        chip={<SavedCardChip brand={card.brand} last4={card.last4} />}
        title={`${brandLabel(card.brand)} •••• ${card.last4}`}
        line={cardLine(card, expired)}
        href={walletCardPath(card.id)}
        onRemove={() => setRemoving(card)}
        radio={
          expired
            ? null
            : { on: checked === "card" && checkedCard === card.id, busy: pending !== null, onPick: () => void choose("card", card.id) }
        }
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
    // PAY'S 8PX MARGINS (Pato, 2026-11-21, MESITA-4591: "too big borders …
    // make them smaller and thinner like the margins"): Screen flush and 8px
    // at the sides and top. It was Screen's 20px plus the page's 16px, 36px.
    <Screen title="Payment methods" paper scrolls flush>
      <div className="px-2 pt-2 pb-8">
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
              {!cardsFailed && (cards?.length ?? 0) < MAX_SAVED_CARDS ? (
                <li>
                  <button
                    type="button"
                    className={cn(ROW, "hover:bg-muted/60 transition")}
                    onClick={() => openAddCardModal(() => reread())}
                    data-add-card
                  >
                    <span className="bg-muted text-foreground flex h-8 w-[3.2rem] shrink-0 items-center justify-center rounded-md" aria-hidden>
                      <Plus className="h-4 w-4" strokeWidth={2.25} />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-base font-semibold">Add card</span>
                    <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" strokeWidth={2.25} aria-hidden />
                  </button>
                </li>
              ) : null}
            </ul>
            <p className="text-muted-foreground mt-4 text-sm leading-relaxed">
              Your default is picked for you when you pay. Stripe keeps the card number; Mesita only sees the last four digits.
            </p>
          </>
        )}
      </div>
      <LocalDialog open={removing !== null} onClose={() => (removeBusy ? undefined : setRemoving(null))} ariaLabel="Remove this card">
        <div className="flex flex-col px-4 pt-5 pb-8" data-remove-card-confirm>
          <h2 className="text-xl font-semibold">
            Remove {removing ? `${brandLabel(removing.brand)} •••• ${removing.last4}` : "this card"}?
          </h2>
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">You can add it again any time.</p>
          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              disabled={removeBusy}
              className={cn(PRIMARY, "disabled:opacity-60")}
              onClick={() => {
                if (removing) void remove(removing);
              }}
            >
              {removeBusy ? "Removing…" : "Remove"}
            </button>
            <button type="button" disabled={removeBusy} className={SECONDARY} onClick={() => setRemoving(null)}>
              Cancel
            </button>
          </div>
        </div>
      </LocalDialog>
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
  onRemove,
}: {
  chip: ReactNode;
  title: string;
  line: string;
  href?: string;
  radio: { on: boolean; busy: boolean; onPick: () => void } | null;
  /** A saved card's trash button (MESITA-4590). */
  onRemove?: () => void;
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
      {onRemove ? (
        <button
          type="button"
          aria-label={`Remove ${title}`}
          onClick={onRemove}
          className="text-muted-foreground hover:text-foreground flex h-16 w-11 shrink-0 items-center justify-center transition"
          data-remove-card
        >
          <Trash2 className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      ) : null}
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
