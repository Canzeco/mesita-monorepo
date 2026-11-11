"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet as WalletIcon } from "lucide-react";
import { TestBand } from "@mesita/place-profile";
import { EmptyState } from "@/components/shared/EmptyState";
import { EFError } from "@/lib/api/_invoke";
import { apiAddCard, apiListCards, apiRemoveCard, CARD_REFUSAL, CARD_RETURN_PARAM, type SavedCard } from "@/lib/api/cards";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { type Method, MethodSheet } from "./MethodSheet";
import { GiftClaimSheet, SendCreditSheet } from "./SendCredit";
import { placeHref } from "@/lib/place-route";
import { cardAmount, giftAction } from "@/lib/wallet-card";
import type { CreditRow as CreditRowModel } from "./use-wallet";
import { useWallet } from "./use-wallet";
import {
  CashRow,
  CreditRow,
  CreditRowSkeleton,
  EmptyCreditsRow,
  HeadingButton,
  RowsSkeleton,
  SavedCardRow,
  StoryRow,
  WalletList,
} from "./WalletLists";

// THE WALLET, REDESIGNED (Pato, 2026-11-11, MESITA-3727, /autoplan approved
// with "rec"; render https://claude.ai/artifact/TyeAaA54EWHfyBdPZpD4wf):
//
//   TestBand (test mode) · "Confirming a payment…" (settling)
//   Credits ................................. [Add] (only once there are cards)
//     waiting Story rows, then each Credits Card with its Fund | Gift footer
//   Ways to pay ......................... [Add card]
//     saved cards, then Cash last
//
// Credits come first: what you hold, then how else you pay. "Ways to pay"
// replaces "Money Payment Methods" so "card" only means a Credits Card.
// The Credits list has four states (creditsState): loading (a card
// skeleton), failed (no Wallet held: "Couldn't load Wallet" under the
// heading), empty (one quiet prompt row, no heading Add) and rows. A failed
// refresh that still holds a Wallet keeps every row.
//
// GIFT is decided once, by giftAction (lib/wallet-card.ts): open the Send to a
// friend sheet, or say why not ("Fund this card first…", or "Credit becomes
// giftable…" while credit is pending or held), or hide it when sending is
// off. Its reason reflects the last Wallet read. Fund opens the place's
// credit purchase, as the House Card's "Buy credits" does.
//
// SAVED CARDS: a first-load failure shows Cash alone and one toast per
// mount; a later failure (after a remove) keeps the cards already shown.
//
// THE WALLET, PAY'S SECOND HALF (Pato, 2026-11-11, MESITA-3698: "Divide
// Payments across two sections: Pay and Wallet"): two lists, Money
// Payment Methods and Credits Payment Methods, each led by Add
// (WalletLists; horizontal rails until MESITA-3701), the Wallet tab's page
// since MESITA-3722 (WalletPage, /wallet); MESITA-3720 drew it under Pay's
// places, with the page's band switched off (`testBand`).
// Wallet was its own bar tab from MESITA-3295, then sat under Pay's list
// (MESITA-3631) until this. A place's card is a link to its House Card,
// /wallet/<placeId> (MESITA-3614); a saved card or a waiting Story opens its
// sheet here. The money is useWallet's (consumer-web-get-wallet).
//
// ADD A CREDITS CARD (Pato, MESITA-3705: "add Credits Card. not add credits
// directly — to add credits you click the card"): Credits' Add goes to
// Search; a place's "Add card to Wallet" (MESITA-3583) puts its card here,
// and the card's House Card is where credits are bought.
//
// /wallet/gift/<token> draws the Wallet with a friend's credit link open
// over it (MESITA-3292); closing it leaves for /wallet.
//
// FUND AND GIFT ON EACH CREDITS CARD (Pato, 2026-11-11, MESITA-3724: "add
// quick button in credits to Fund and Gift buttons to each Credits Card"):
// Fund opens the place's credit purchase (the House Card's "Buy credits",
// `?rewards=prepayment` on the place); Gift opens the House Card's "Send to a
// friend" sheet here, greyed out while nothing can be sent (spendable $0,
// or sending off). A place gone from Mesita gets neither.

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

export function WalletSection({ giftToken = null, testBand = true }: { giftToken?: string | null; testBand?: boolean }) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const { wallet, failed, credits, reread } = useWallet();
  const [method, setMethod] = useState<Method | null>(null);
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [cardsNonce, setCardsNonce] = useState(0);
  const [adding, setAdding] = useState(false);
  // The saved-card failure toast fires at most once per mount.
  const cardsToasted = useRef(false);
  // The Credits Card whose Gift sheet is open (MESITA-3724).
  const [gifting, setGifting] = useState<CreditRowModel | null>(null);
  const canSend = wallet?.can_send === true;
  const actionsFor = (row: CreditRowModel) => {
    // A place gone from Mesita: its House Card says to ask support.
    if (row.balance.place === null) return null;
    const action = giftAction({
      canSend,
      spendableCents: row.balance.spendable_cents,
      shownCents: cardAmount(row.card).cents,
    });
    return {
      fundHref: `${placeHref(row.placeSlug)}?rewards=prepayment`,
      gift:
        action === null
          ? null
          : action === "open"
            ? { kind: "open" as const, onOpen: () => setGifting(row) }
            : { kind: "blocked" as const, message: action.blocked, onTap: () => toast(action.blocked) },
    };
  };
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
        if (cancelled) return;
        // A first-load failure shows Cash alone; a later one keeps the cards shown.
        setCards((prev) => prev ?? []);
        if (!cardsToasted.current) {
          cardsToasted.current = true;
          toast.error("Couldn't load your saved cards");
        }
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
  const stories = wallet?.waiting_stories ?? [];
  // One state drives the Credits heading button, box, empty row and error.
  const creditsState: "loading" | "failed" | "empty" | "rows" =
    failed && !wallet
      ? "failed"
      : !wallet || credits === null
        ? "loading"
        : credits.length === 0 && stories.length === 0
          ? "empty"
          : "rows";

  return (
    <div className="flex flex-col" data-wallet>
      {testBand && wallet?.test_mode ? <TestBand className="mt-5" /> : null}
      {wallet?.settling ? (
        <p className="text-muted-foreground mt-5 text-sm" role="status">
          Confirming a payment…
        </p>
      ) : null}

      <WalletList
        title="Credits"
        fullDividers
        action={
          creditsState === "rows" ? (
            <HeadingButton label="Add" ariaLabel="Add a Credits Card" href={CONSUMER_ROUTES.search} />
          ) : null
        }
        fallback={
          creditsState === "failed" ? (
            <EmptyState
              icon={WalletIcon}
              title="Couldn't load Wallet"
              description="Check your connection and try again."
              action={{ label: "Try again", onClick: reread }}
            />
          ) : null
        }
      >
        {creditsState === "loading" ? <CreditRowSkeleton /> : null}
        {creditsState === "empty" ? <EmptyCreditsRow href={CONSUMER_ROUTES.search} /> : null}
        {creditsState === "rows"
          ? stories.map((s) => <StoryRow key={s.purchase_id} story={s} onOpen={() => setMethod({ kind: "story", story: s })} />)
          : null}
        {creditsState === "rows"
          ? credits?.map((row) => (
              <CreditRow key={row.card.key} card={row.card} eager={shown++ < EAGER_CARDS} actions={actionsFor(row)} />
            ))
          : null}
      </WalletList>

      <WalletList
        title="Ways to pay"
        action={
          <HeadingButton
            label={adding ? "Opening…" : "Add card"}
            ariaLabel="Add a payment card"
            onClick={() => void addCard()}
            disabled={adding}
            className="min-w-[5.5rem]"
          />
        }
      >
        {cards === null ? <RowsSkeleton count={1} /> : null}
        {cards?.map((c) => <SavedCardRow key={c.id} card={c} onOpen={() => setMethod({ kind: "card", card: c })} />)}
        <CashRow />
      </WalletList>

      <MethodSheet method={method} onClose={() => setMethod(null)} onRemoveCard={removeCard} />
      <SendCreditSheet
        open={gifting !== null}
        onClose={() => setGifting(null)}
        onSent={reread}
        placeId={gifting?.placeId ?? ""}
        placeName={gifting?.card.name ?? ""}
        currency={gifting?.card.currency ?? "MXN"}
        spendableCents={gifting?.balance.spendable_cents ?? 0}
      />
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
