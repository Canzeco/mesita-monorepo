"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ReceiptText, Wallet as WalletIcon } from "lucide-react";
import { TestBand } from "@mesita/place-profile";
import { RowDivider } from "@/components/consumer/me/settings-rows";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { EFError } from "@/lib/api/_invoke";
import { apiAddCard, apiListCards, apiRemoveCard, CARD_REFUSAL, CARD_RETURN_PARAM, type SavedCard } from "@/lib/api/cards";
import { apiGetWallet, GIFT_PARAM, type Wallet, type WalletBalance } from "@/lib/api/wallet";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { WalletCard, type WalletCardModel } from "./WalletCard";
import { type Method, MethodSheet } from "./MethodSheet";
import { GiftClaimSheet } from "./SendCredit";
import { AddTile, CashTile, CheckoutMethodTile, RAIL_TILE, RailSkeleton, SavedCardTile, StoryTile, WalletRail } from "./WalletRails";

// TWO RAILS SINCE MESITA-3530 (Pato, 2026-11-09: "add some header to the
// page called Wallet, and then at the right that icon for transactions ...
// TWO HORIZONTAL CAROUSELS with cards. only that in that page"): the header
// (Wallet, and Transactions on the right), then Money Payment Methods and
// Credits Payment Methods, each led by Add (WalletRails). A card's history
// lives in Me › Transactions now; a credit card opens its place.
//
// Before: THE WALLET IS A LIST OF CARDS (Pato, MESITA-3511, 2026-11-08: "a list of
// all your cards, using card dimensions and mentioning how much you have on
// each"). The bar's Wallet tab, /wallet: one house card per place
// (`WalletCard`). Places where the guest has money now or on its way come
// first (newest first), then $0 balances that still have history.
// Money comes from consumer-web-get-wallet only; this screen never adds
// anything up (MESITA-3098).
//
// Checkout comes back here with `?prepay=<session>`: the read credits it,
// the toast says what the server said, and the parameter is dropped so a
// reload does not ask again. While the server is still confirming a
// purchase (`settling`) the page says so and asks again. A card with
// history opens it under the card; a "Paid" row opens that payment's proof
// on Pay (MESITA-3304). In test mode the TestBand leads the page.

// ONLY MESITA PAY PLACES WITH CREDIT OR HISTORY (MESITA-3514, Pato,
// 2026-11-08: "ONLY THE CARDS OF THE PLACES THAT ACCEPT MESITA PAY AND THAT
// YOU HAVE CREDITS FROM OR HAVE LIKE AN HISTORY"): a card per balance row of
// consumer-web-get-wallet, no catalog read. Both name marks (`boost_tier`,
// `mesita_pay`) ride the balance's `place`. A $0 balance with history shows
// only while its place takes Mesita Pay; money held never hides, even at a
// place that has since turned Mesita Pay off.

const PREPAY_PARAM = "prepay";

// SAVED CARDS (MESITA-3523, Pato's 2026-11-08 sketch: a Cards box with Add):
// Add on the Money rail opens Stripe's own page in setup mode; it returns
// here with `?card=<session>`, the page says "Card saved." and drops the
// parameter. Each saved card is a tile after the checkout one; its sheet
// removes it. The list is the server's (consumer-web-list-cards), read on
// mount and after every add or remove.

function cardRefusal(err: unknown): string {
  const code = err instanceof EFError ? err.code : null;
  return (code && CARD_REFUSAL[code]) || "Something went wrong. Try again.";
}
/** A purchase the server is still confirming is asked about again. */
const SETTLING_RETRY_MS = 4_000;
/** Photos of the first cards load eagerly; the rest lazily. */
const EAGER_CARDS = 3;

function sayOutcome(w: Wallet) {
  switch (w.outcome) {
    case "credited":
    case "already_paid":
      toast.success("Added to your balance.");
      return;
    case "expired":
      toast("Checkout cancelled. Nothing was charged.");
      return;
    case "pending":
      toast("Confirming your payment…");
      return;
    default:
      return;
  }
}

type Row = { card: WalletCardModel; balance: WalletBalance | null; placeId: string; placeSlug: string };

function hasMoney(b: WalletBalance): boolean {
  return b.available_cents > 0 || b.pending_cents > 0;
}

function newestFirst(a: WalletBalance, b: WalletBalance): number {
  return b.last_at.localeCompare(a.last_at);
}

/** Money held always shows; a $0 balance only where Mesita Pay is on. */
function shows(b: WalletBalance): boolean {
  return hasMoney(b) || b.place?.mesita_pay === true;
}

function balanceRow(b: WalletBalance): Row {
  const name = b.place?.name ?? "A Mesita place";
  // Every card opens its method sheet (MESITA-3533): history, Pay here,
  // Buy credits and the place live there.
  const tap: WalletCardModel["tap"] = { kind: "open" };
  return {
    balance: b,
    placeId: b.place_id,
    placeSlug: b.place?.slug ?? b.place_id,
    card: {
      key: `${b.place_id}:${b.currency}`,
      name,
      photo: b.place?.photo ?? null,
      tier: b.place?.boost_tier ?? null,
      mesitaPay: b.place?.mesita_pay === true,
      currency: b.currency,
      available_cents: b.available_cents,
      pending_cents: b.pending_cents,
      hasBalance: true,
      tap,
    },
  };
}

export function WalletPage() {
  const getSupabase = useLazyBrowserSupabase();
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [method, setMethod] = useState<Method | null>(null);
  // A friend's credit link (MESITA-3292): /wallet?gift=<token>. Read with
  // the Wallet and dropped from the address, so a reload does not ask again.
  const [giftToken, setGiftToken] = useState<string | null>(null);
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [cardsNonce, setCardsNonce] = useState(0);
  const [adding, setAdding] = useState(false);

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
        // The rail keeps Add and the checkout card; a failed list shows none.
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

  // Balances: on mount, on Try again, and again while a purchase settles.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const params = new URLSearchParams(window.location.search);
    const session = params.get(PREPAY_PARAM) ?? undefined;
    const gift = params.get(GIFT_PARAM);
    if (session || gift) {
      params.delete(PREPAY_PARAM);
      params.delete(GIFT_PARAM);
      const q = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    }
    void apiGetWallet(getSupabase(), session)
      .finally(() => {
        if (gift && !cancelled) setGiftToken(gift);
      })
      .then((w) => {
        if (cancelled) return;
        setWallet(w);
        setFailed(false);
        if (session) sayOutcome(w);
        // Still confirming: ask once more after a moment.
        if (w.settling || (session && w.outcome === "pending")) {
          timer = setTimeout(() => {
            if (!cancelled) setNonce((n) => n + 1);
          }, SETTLING_RETRY_MS);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  // Derived, never stored: a balance that appears on a settling retry
  // takes its card on the next render.
  const credits = useMemo(() => {
    if (!wallet) return null;
    const shown = wallet.balances.filter(shows);
    return [
      ...shown.filter(hasMoney).sort(newestFirst),
      ...shown.filter((b) => !hasMoney(b)).sort(newestFirst),
    ].map(balanceRow);
  }, [wallet]);

  // The open sheet follows the latest read (MESITA-3549): a re-read while it
  // is open (settling, a pending entry turning Available, a credit link sent
  // or taken back, MESITA-3292) updates it, links and all.
  const liveMethod = useMemo<Method | null>(() => {
    if (method?.kind !== "place" || !credits) return method;
    const row = credits.find((r) => r.card.key === method.card.key);
    const sentLinks = (wallet?.sent_links ?? []).filter((l) => l.place_id === method.placeId && l.currency === method.card.currency);
    return { ...method, ...(row ? { card: row.card, balance: row.balance } : {}), sentLinks, canSend: wallet?.can_send === true };
  }, [method, credits, wallet]);
  const reread = useCallback(() => setNonce((n) => n + 1), []);

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
        <CheckoutMethodTile onOpen={() => setMethod({ kind: "checkout" })} />
        {cards?.map((c) => <SavedCardTile key={c.id} card={c} onOpen={() => setMethod({ kind: "card", card: c })} />)}
      </WalletRail>

      <WalletRail title="Credits Payment Methods">
        <AddTile label="Add" line="Buy credits on a place's Offers" href={CONSUMER_ROUTES.home} />
        {wallet?.waiting_stories?.map((s) => <StoryTile key={s.purchase_id} story={s} onOpen={() => setMethod({ kind: "story", story: s })} />)}
        {credits?.map((row) => (
          <div key={row.card.key} className={RAIL_TILE}>
            <WalletCard
              card={row.card}
              compact
              eager={shown++ < EAGER_CARDS}
              onToggle={() =>
                setMethod({
                  kind: "place",
                  card: row.card,
                  balance: row.balance,
                  placeId: row.placeId,
                  placeSlug: row.placeSlug,
                  canSend: wallet?.can_send === true,
                  sentLinks: [],
                })}
            />
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
            action={{ label: "Try again", onClick: () => setNonce((n) => n + 1) }}
          />
        </div>
      ) : null}

      <MethodSheet method={liveMethod} onClose={() => setMethod(null)} onReread={reread} onRemoveCard={removeCard} />
      <GiftClaimSheet
        token={giftToken}
        onClose={() => setGiftToken(null)}
        onClaimed={() => {
          setGiftToken(null);
          setNonce((n) => n + 1);
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
