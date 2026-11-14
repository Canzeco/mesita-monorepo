"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet as WalletIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { EFError } from "@/lib/api/_invoke";
import { photoUrl } from "@mesita/place-profile";
import { apiAddCard, apiRemoveCard, CARD_REFUSAL, CARD_RETURN_PARAM, MAX_SAVED_CARDS, type SavedCard } from "@/lib/api/cards";
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
  SavedCardRow,
  StoryRow,
  WalletBodySkeleton,
  WalletList,
} from "./WalletLists";

// ONE READ, ONE PAINT (Pato, 2026-11-12, MESITA-3814: "first load the
// functions and then display all the wallets, don't display stuff in an
// async manner ... unify them"): the saved cards ride the Wallet's own read
// (consumer-web-get-wallet `with_cards`; consumer-web-list-cards no longer
// feeds this page), and nothing shows until that read answers and the first
// Credits photos are decoded (PHOTO_WAIT_MS at most): until then the whole
// page is WalletBodySkeleton, the shape /wallet's loading frame draws too.
// Cash and both Add rows wait with the rest. A refresh (a removed card, a
// redeemed code, a settling retry) keeps the page shown and swaps it whole.
// Stripe failing leaves `cards` null: Cash shows alone, one toast says so,
// the money still shows.

// TWO LISTS, ONE ROW SHAPE (Pato, 2026-11-11, MESITA-3741: "make the same
// list of cards as with the money payment methods. keep the symmetry"):
// Credits Payment Methods is one white card of rows exactly like Money
// Payment Methods: waiting Story rows, then a CreditsRow per place (its
// House Card on tap), "Find a place" when there is none. No black band,
// transactions or Fund | Gift here any more: Add Credits, Gift Credits, Go
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
// Fund opens the place's credit purchase (the House Card's "Add Credits",
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
/** Photos of the first cards load eagerly; the rest lazily. The page waits
 *  for these to decode before it shows (MESITA-3814). */
const EAGER_CARDS = 3;
/** The longest the page waits on those photos: a slow photo never holds it. */
const PHOTO_WAIT_MS = 800;

/** Resolves once every photo is decoded (or failed), or after `ms`. */
function decodeAll(urls: string[], ms: number): Promise<void> {
  const each = urls.map((src) => {
    const img = new Image();
    img.src = src;
    return img.decode().catch(() => undefined);
  });
  return Promise.race([Promise.all(each).then(() => undefined), new Promise<void>((r) => setTimeout(r, ms))]);
}

export function WalletSection({
  giftToken = null,
  redeeming,
  onRedeemClose,
}: {
  giftToken?: string | null;
  /** The Redeem a code sheet is open: Redeem Credits, at the page's top
   *  (MESITA-3894; the Credits list's "Gift code" row until then). */
  redeeming: boolean;
  onRedeemClose: () => void;
}) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const { wallet, failed, credits, reread } = useWallet({ withCards: true });
  const [method, setMethod] = useState<Method | null>(null);
  const [adding, setAdding] = useState(false);
  // The saved-card failure toast fires at most once per mount.
  const cardsToasted = useRef(false);
  // A friend's credit link (MESITA-3292) opens over the Wallet once the
  // Wallet has read; closing it leaves its address for the Wallet's.
  const [gift, setGift] = useState(giftToken);
  const closeGift = useCallback(() => {
    setGift(null);
    navigateTo(router, CONSUMER_ROUTES.wallet, { replace: true });
  }, [router]);

  // Stripe's return from saving a card (`?card=`): say so, drop the param.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has(CARD_RETURN_PARAM)) return;
    params.delete(CARD_RETURN_PARAM);
    const q = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${q ? `?${q}` : ""}`);
    toast.success("Card saved.");
  }, []);

  // Saved cards come with the Wallet's read; null means Stripe failed.
  const cards: SavedCard[] = wallet?.cards ?? [];
  const cardsFailed = wallet !== null && wallet.cards === null;
  useEffect(() => {
    if (cardsFailed && !cardsToasted.current) {
      cardsToasted.current = true;
      toast.error("Couldn't load your saved cards");
    }
  }, [cardsFailed]);

  // The first Credits photos, decoded before the page shows.
  const photoKey = (credits ?? [])
    .slice(0, EAGER_CARDS)
    .map((r) => r.card.photo)
    .filter((p): p is string => !!p)
    .map((p) => photoUrl(p, "thumb"))
    .join("\n");
  // Painted once, the page stays: a refresh swaps it whole, never blanks it.
  const [painted, setPainted] = useState(false);
  useEffect(() => {
    if (!wallet || painted) return;
    let cancelled = false;
    void decodeAll(photoKey ? photoKey.split("\n") : [], PHOTO_WAIT_MS).then(() => {
      if (!cancelled) setPainted(true);
    });
    return () => {
      cancelled = true;
    };
  }, [wallet, photoKey, painted]);
  const ready = painted || (failed && !wallet);

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
        reread();
      } catch (err) {
        toast.error(cardRefusal(err));
      }
    },
    [getSupabase, reread],
  );

  if (!ready) return <WalletBodySkeleton />;

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
        {cards.map((c) => <SavedCardRow key={c.id} card={c} onOpen={() => setMethod({ kind: "card", card: c })} />)}
        <CashRow />
        {/* Add is the list's last row (MESITA-3744), and reads "Add" in both
            lists (Pato, MESITA-3740: "add and add, keep the symmetry"). It
            leaves once three cards are saved (MESITA-3749); Credits Cards
            have no limit. */}
        {cards.length < MAX_SAVED_CARDS ? (
          <AddRow line="A debit or credit card" ariaLabel="Add a payment card" onClick={() => void addCard()} disabled={adding} busy={adding} />
        ) : null}
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

      <MethodSheet method={method} onClose={() => setMethod(null)} onRemoveCard={removeCard} />
      <RedeemCodeSheet
        open={redeeming}
        onClose={onRedeemClose}
        onClaimed={() => {
          onRedeemClose();
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
