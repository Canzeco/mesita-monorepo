"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EFError } from "@/lib/api/_invoke";
import { apiAddCard, apiListCards, apiRemoveCard, CARD_REFUSAL, CARD_RETURN_PARAM, type SavedCard } from "@/lib/api/cards";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import type { WaitingStory, Wallet } from "@/lib/api/wallet";
import { type Method, MethodSheet } from "./MethodSheet";
import { GiftClaimSheet } from "./SendCredit";
import { AddRow, CashRow, SavedCardRow, WalletList } from "./WalletLists";

// MONEY PAYMENT METHODS, THE ONE BOX UNDER PAY'S PLACES (Pato, 2026-11-11,
// MESITA-3721, "Build it" on the design review's option C): Cash, the saved
// cards, then Add a card last. Credits left this file: a place's credits
// show on its row in Pay's list (PayPage), which also draws the waiting
// Story rows and owns the Wallet read (useWallet), handed in here for the
// sheets. "Credits Payment Methods" and its Add are gone with the list.
// What follows is the history of the two lists this replaces.
//
// THE WALLET, PAY'S SECOND HALF (Pato, 2026-11-11, MESITA-3698: "Divide
// Payments across two sections: Pay and Wallet"): two lists, Money
// Payment Methods and Credits Payment Methods, each led by Add
// (WalletLists; horizontal rails until MESITA-3701), drawn under Pay's places
// on the one Pay page since MESITA-3720 (PayPage; /pay and /wallet both).
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
export function WalletSection({
  wallet,
  failed,
  reread,
  giftToken = null,
  story = null,
  onCloseStory,
}: {
  /** The Wallet read, owned by PayPage (useWallet). */
  wallet: Wallet | null;
  failed: boolean;
  reread: () => void;
  giftToken?: string | null;
  /** A waiting Story tapped in Pay's list: its QR sheet opens here. */
  story?: WaitingStory | null;
  onCloseStory: () => void;
}) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
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

  return (
    <div className="flex flex-col" data-wallet>
      {wallet?.settling ? (
        <p className="text-muted-foreground mt-5 text-sm" role="status">
          Confirming a payment…
        </p>
      ) : null}

      <WalletList title="Money Payment Methods">
        <CashRow />
        {cards?.map((c) => <SavedCardRow key={c.id} card={c} onOpen={() => setMethod({ kind: "card", card: c })} />)}
        <AddRow label={adding ? "Opening…" : "Add a card"} line="Save a card with Stripe" onClick={() => void addCard()} />
      </WalletList>

      <MethodSheet
        method={story ? { kind: "story", story } : method}
        onClose={() => {
          setMethod(null);
          onCloseStory();
        }}
        onRemoveCard={removeCard}
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
