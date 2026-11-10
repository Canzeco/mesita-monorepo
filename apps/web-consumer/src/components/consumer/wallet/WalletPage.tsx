"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ReceiptText, Wallet as WalletIcon } from "lucide-react";
import { TestBand } from "@mesita/place-profile";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { EFError } from "@/lib/api/_invoke";
import { apiAddCard, apiListCards, apiRemoveCard, CARD_REFUSAL, CARD_RETURN_PARAM, type SavedCard } from "@/lib/api/cards";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { WalletCard } from "./WalletCard";
import { type Method, MethodSheet } from "./MethodSheet";
import { GiftClaimSheet } from "./SendCredit";
import { useWallet } from "./use-wallet";
import { AddTile, CashTile, RAIL_TILE, RailSkeleton, SavedCardTile, StoryTile, WalletRail } from "./WalletRails";

// THE WALLET TAB, /wallet. TWO RAILS SINCE MESITA-3530 (Pato, 2026-11-09:
// "add some header to the page called Wallet, and then at the right that
// icon for transactions ... TWO HORIZONTAL CAROUSELS with cards. only that
// in that page"): the header (Wallet, and Transactions on the right), then
// Money Payment Methods and Credits Payment Methods, each led by Add
// (WalletRails). A place's card is a link to its House Card,
// /wallet/<placeId> (MESITA-3614); a saved card or a waiting Story opens its
// sheet here. The money is useWallet's (consumer-web-get-wallet). In test
// mode the TestBand leads the page.
//
// /wallet/gift/<token> draws this screen with a friend's credit link open
// over it (MESITA-3292); closing it leaves for /wallet.

// SAVED CARDS (MESITA-3523, Pato's 2026-11-08 sketch: a Cards box with Add):
// Add on the Money rail opens Stripe's own page in setup mode; it returns
// here with `?card=<session>`, the page says "Card saved." and drops the
// parameter. Each saved card is a tile after Cash (no generic "card at checkout" tile: Pato, MESITA-3557, "that card is fake and should not exist"); its sheet
// removes it. The list is the server's (consumer-web-list-cards), read on
// mount and after every add or remove.

function cardRefusal(err: unknown): string {
  const code = err instanceof EFError ? err.code : null;
  return (code && CARD_REFUSAL[code]) || "Something went wrong. Try again.";
}
/** Photos of the first cards load eagerly; the rest lazily. */
const EAGER_CARDS = 3;

export function WalletPage({ giftToken = null }: { giftToken?: string | null }) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const { wallet, failed, credits, reread } = useWallet();
  const [method, setMethod] = useState<Method | null>(null);
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [cardsNonce, setCardsNonce] = useState(0);
  const [adding, setAdding] = useState(false);
  // A friend's credit link (MESITA-3292) opens over the Wallet once the
  // Wallet has read; closing it leaves its address for the Wallet's.
  const [gift, setGift] = useState(giftToken);
  const closeGift = useCallback(() => {
    setGift(null);
    navigateTo(router, CONSUMER_ROUTES.wallet, { replace: true });
  }, [router]);

  // Saved cards: on mount, on Stripe's return, after a remove.
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams(window.location.search);
    if (params.has(CARD_RETURN_PARAM)) {
      params.delete(CARD_RETURN_PARAM);
      const q = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
      toast.success("Card saved.");
    }
    void apiListCards(getSupabase())
      .then((r) => {
        if (!cancelled) setCards(r.cards);
      })
      .catch(() => {
        // The rail keeps Add and Cash; a failed list shows no cards.
        if (!cancelled) setCards([]);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsNonce]);

  const addCard = useCallback(async () => {
    if (adding) return;
    setAdding(true);
    try {
      const { url } = await apiAddCard(getSupabase(), `${window.location.origin}${CONSUMER_ROUTES.wallet}`);
      window.location.assign(url);
    } catch (err) {
      toast.error(cardRefusal(err));
      setAdding(false);
    }
  }, [adding, getSupabase]);

  const removeCard = useCallback(
    async (card: SavedCard) => {
      try {
        await apiRemoveCard(getSupabase(), card.id);
        toast.success("Card removed.");
        setMethod(null);
        setCardsNonce((n) => n + 1);
      } catch (err) {
        toast.error(cardRefusal(err));
      }
    },
    [getSupabase],
  );

  let shown = 0;

  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8">
      {/* THE HEADER (MESITA-3530): Wallet, and Transactions on the right. Its
          own colour since MESITA-3534 (Pato: "add a header of different
          color"): a white bar, full width, a hairline under it, held at the
          top while the page scrolls. */}
      <header className="border-border bg-card sticky top-0 z-10 -mx-4 flex items-center justify-between gap-3 border-b px-4 pt-5 pb-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Wallet</h1>
        <Link
          href={CONSUMER_ROUTES.mePages.transactions}
          aria-label="Transactions"
          className="border-border bg-paper hover:bg-muted flex h-11 w-11 items-center justify-center rounded-xl border transition"
          data-wallet-transactions
        >
          <ReceiptText className="h-5 w-5" aria-hidden />
        </Link>
      </header>
      {wallet?.test_mode ? <TestBand className="mt-3" /> : null}
      {wallet?.settling ? (
        <p className="text-muted-foreground mt-3 text-sm" role="status">
          Confirming a payment…
        </p>
      ) : null}

      <WalletRail title="Money Payment Methods">
        <AddTile label={adding ? "Opening…" : "Add"} line="Save a card" onClick={() => void addCard()} />
        <CashTile />
        {cards?.map((c) => <SavedCardTile key={c.id} card={c} onOpen={() => setMethod({ kind: "card", card: c })} />)}
      </WalletRail>

      <WalletRail title="Credits Payment Methods">
        <AddTile label="Add" line="Buy credits on a place's Offers" href={CONSUMER_ROUTES.home} />
        {wallet?.waiting_stories?.map((s) => <StoryTile key={s.purchase_id} story={s} onOpen={() => setMethod({ kind: "story", story: s })} />)}
        {credits?.map((row) => (
          <div key={row.card.key} className={RAIL_TILE}>
            <WalletCard card={row.card} compact eager={shown++ < EAGER_CARDS} />
          </div>
        ))}
        {!credits && !failed ? <RailSkeleton /> : null}
      </WalletRail>

      {failed && !wallet ? (
        <div className="mt-5 flex flex-1 flex-col">
          <EmptyState
            icon={WalletIcon}
            title="Couldn't load Wallet"
            description="Check your connection and try again."
            action={{ label: "Try again", onClick: reread }}
          />
        </div>
      ) : null}

      <MethodSheet method={method} onClose={() => setMethod(null)} onRemoveCard={removeCard} />
      <GiftClaimSheet
        token={wallet || failed ? gift : null}
        onClose={closeGift}
        onClaimed={() => {
          closeGift();
          reread();
        }}
      />
    </div>
  );
}

/** The old card of rows' bones, kept for Transactions (Me › Transactions). */
export function WalletSkeleton() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border" aria-hidden>
      {[0, 1, 2].map((i) => (
        <Fragment key={i}>
          {i > 0 && <RowDivider />}
          <div className="flex min-h-16 items-center gap-3 px-4 py-3">
            <Skeleton className="h-11 w-11 rounded-lg" />
            <span className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1.5 h-3 w-20" />
            </span>
            <Skeleton className="h-5 w-16" />
          </div>
        </Fragment>
      ))}
    </div>
  );
}
