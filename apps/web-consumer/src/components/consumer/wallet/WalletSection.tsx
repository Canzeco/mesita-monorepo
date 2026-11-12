"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet as WalletIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { EFError } from "@/lib/api/_invoke";
import { apiAddCard, apiListCards, apiRemoveCard, CARD_REFUSAL, CARD_RETURN_PARAM, type SavedCard } from "@/lib/api/cards";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { placeHref } from "@/lib/place-route";
import { type Method, MethodSheet } from "./MethodSheet";
import { GiftClaimSheet, RedeemCodeSheet } from "./SendCredit";
import { useWallet } from "./use-wallet";
import {
  CashRow,
  CreditsRow,
  EmptyCreditsRow,
  AddRow,
  RowsSkeleton,
  SavedCardRow,
  StoryRow,
  WalletList,
} from "./WalletLists";

// TWO LISTS, ONE ROW SHAPE (Pato, 2026-11-11, MESITA-3741: "make the same
// list of cards as with the money payment methods. keep the symmetry"):
// Credits Payment Methods is one white card of rows exactly like Money
// Payment Methods: waiting Story rows, then a CreditsRow per place (its
// House Card on tap), "Find a place" when there is none. No black band,
// transactions or Fund | Gift here any more: Buy Credits, Gift Credits, Go
// to Pay and the history are on the House Card page (PlaceCredit). The
// notes below are the history.
//
// MONEY FIRST, CREDITS CARDS WITH THEIR TRANSACTIONS (Pato, 2026-11-11,
// MESITA-3736, /plan-design-review, every choice his: "money payment methods
// on top, and card payment methods on bottom. each card must have the
// transactions and a button to add funds (prepay) and a button to gift
// funds"): Money Payment Methods first, then Credits Payment Methods: waiting
// Story rows, then one CreditsCard per place (a black band, its 3 newest
// entries, Fund | Gift). No card: EmptyCreditsCard. It undoes MESITA-3727's
// Credits-first order and MESITA-3731's "Fund and Gift go inside"; the notes
// below are the history.
//
// PLAIN CARDS, PATO'S HEADINGS (Pato, 2026-11-11, MESITA-3731: "keep just the
// card without the buttons to fund nor gift. those must go inside";
// "Credits Payment Methods / Money Payment Methods"): a Credits Card is just
// its row, Fund and Gift are on its House Card page (PlaceCredit), and the
// lists read Credits Payment Methods, then Money Payment Methods. The notes
// below describe MESITA-3727's layout, under the names it used.
//
// THE WALLET, REDESIGNED (Pato, 2026-11-11, MESITA-3727, /autoplan approved
// with "rec"; render https://claude.ai/artifact/TyeAaA54EWHfyBdPZpD4wf):
//
//   "Confirming a payment…" (settling; the TEST band left in MESITA-3732)
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
// GIFT and FUND moved inside the card (MESITA-3731): the House Card page
// (PlaceCredit) shows them; Gift is still decided by giftAction.
//
// SAVED CARDS: a first-load failure shows Cash alone and one toast per
// mount; a later failure (after a remove) keeps the cards already shown.
//
// THE WALLET, PAY'S SECOND HALF (Pato, 2026-11-11, MESITA-3698: "Divide
// Payments across two sections: Pay and Wallet"): two lists, Money
// Payment Methods and Credits Payment Methods, each ending in an Add row
// (MESITA-3744; led by Add on the heading until then)
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

export function WalletSection({ giftToken = null }: { giftToken?: string | null }) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const { wallet, failed, credits, reread } = useWallet();
  const [method, setMethod] = useState<Method | null>(null);
  const [cards, setCards] = useState<SavedCard[] | null>(null);
  const [cardsNonce, setCardsNonce] = useState(0);
  const [adding, setAdding] = useState(false);
  // The saved-card failure toast fires at most once per mount.
  const cardsToasted = useRef(false);
  // A friend's credit link (MESITA-3292) opens over the Wallet once the
  // Wallet has read; closing it leaves its address for the Wallet's.
  const [gift, setGift] = useState(giftToken);
  // A friend's 12-digit gift code typed in (MESITA-3737).
  const [redeeming, setRedeeming] = useState(false);
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
      {wallet?.settling ? (
        <p className="text-muted-foreground mt-5 text-sm" role="status">
          Confirming a payment…
        </p>
      ) : null}

      <WalletList title="Money Payment Methods">
        {cards === null ? <RowsSkeleton count={1} /> : null}
        {cards?.map((c) => <SavedCardRow key={c.id} card={c} onOpen={() => setMethod({ kind: "card", card: c })} />)}
        <CashRow />
        {/* Add is the list's last row (MESITA-3744), and reads "Add" in both
            lists (Pato, MESITA-3740: "add and add, keep the symmetry"). */}
        <AddRow line="A debit or credit card" ariaLabel="Add a payment card" onClick={() => void addCard()} disabled={adding} busy={adding} />
      </WalletList>

      <WalletList
        title="Credits Payment Methods"
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
        {creditsState === "loading" ? <RowsSkeleton count={1} /> : null}
        {creditsState === "empty" ? <EmptyCreditsRow href={CONSUMER_ROUTES.search} /> : null}
        {creditsState === "rows"
          ? stories.map((s) => <StoryRow key={s.purchase_id} story={s} onOpen={() => setMethod({ kind: "story", story: s })} />)
          : null}
        {creditsState === "rows"
          ? credits?.map((row) => (
              <CreditsRow
                key={row.card.key}
                card={row.card}
                href={row.card.tap.kind === "link" ? row.card.tap.href : placeHref(row.placeSlug)}
                gone={row.balance.place === null}
                eager={shown++ < EAGER_CARDS}
              />
            ))
          : null}
        {creditsState === "rows" ? (
          <AddRow line="A place's Credits Card" ariaLabel="Add a Credits Card" href={CONSUMER_ROUTES.search} />
        ) : null}
      </WalletList>
      <div>
        <button
          type="button"
          onClick={() => setRedeeming(true)}
          className="text-muted-foreground hover:text-foreground mt-2 py-2 text-sm font-semibold transition"
          data-redeem-code-open
        >
          Have a gift code?
        </button>
      </div>

      <MethodSheet method={method} onClose={() => setMethod(null)} onRemoveCard={removeCard} />
      <RedeemCodeSheet
        open={redeeming}
        onClose={() => setRedeeming(false)}
        onClaimed={() => {
          setRedeeming(false);
          reread();
        }}
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
