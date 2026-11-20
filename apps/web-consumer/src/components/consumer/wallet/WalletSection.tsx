"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet as WalletIcon } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { photoUrl } from "@mesita/place-profile";
import { type SavedCard } from "@/lib/api/cards";
import { Screen } from "@/components/consumer/nav/Screen";
import { CONSUMER_ROUTES, storyTicketPath, walletCardPath } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "@/lib/toast";
import { placeHref } from "@/lib/place-route";
import { AddCreditsCardDialog } from "./AddCreditsCardDialog";
import { GiftClaimSheet } from "./SendCredit";
import { useWallet } from "./use-wallet";
import { useStoryNow } from "./use-story-now";
import { openStories } from "@/lib/story-lines";
import {
  AddCardTile,
  CardTileSkeleton,
  AddRow,
  CardTile,
  CreditsRow,
  EmptyLoyaltyLine,
  PaymentMethods,
  RowsSkeleton,
  StoryRow,
  WalletBodySkeleton,
  WalletPanelList,
  pendingWords,
} from "./WalletLists";
import { money, type WalletBalance } from "@/lib/api/wallet";
import { openAddCardModal } from "@/lib/added-card";

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
// Loyalty Card on tap), "Find a place" when there is none. No black band,
// transactions or Fund | Gift here any more: Buy Credits, Send Gift, Go
// to Pay and the history are on the Loyalty Card page (PlaceCredit). The
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
// its row, Fund and Gift are on its Loyalty Card page (PlaceCredit), and the
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
// GIFT and FUND moved inside the card (MESITA-3731): the Loyalty Card page
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
// (MESITA-3631) until this. A place's card is a link to its Loyalty Card,
// /wallet/place/<placeId> (MESITA-3614); a saved card or a waiting Story opens its
// sheet here. The money is useWallet's (consumer-web-get-wallet).
//
// ADD A CREDITS CARD (Pato, MESITA-3705: "add Credits Card. not add credits
// directly — to add credits you click the card"): Credits' Add goes to
// Search; a place's "Add card to Wallet" (MESITA-3583) puts its card here,
// and the card's Loyalty Card is where credits are bought.
//
// /wallet/gift/<token> draws the Wallet with a friend's credit link open
// over it (MESITA-3292); closing it leaves for /wallet.
//
// FUND AND GIFT ON EACH CREDITS CARD (Pato, 2026-11-11, MESITA-3724: "add
// quick button in credits to Fund and Gift buttons to each Credits Card"):
// Fund opens the place's credit purchase (the Loyalty Card's "Buy Credits",
// `/place/<id>/offers?rewards=prepayment`, MESITA-4379); Gift opens the Loyalty Card's "Send to a
// friend" sheet here, greyed out while nothing can be sent (spendable $0,
// or sending off). A place gone from Mesita gets neither.

// SAVED CARDS (MESITA-3523, Pato's 2026-11-08 sketch: a Cards box with Add):
// Add on the Money rail opens Stripe's own page in setup mode; it returns
// here with `?card=<session>`, the page says "Card saved." and drops the
// parameter. Each saved card is a tile after Cash (no generic "card at checkout" tile: Pato, MESITA-3557, "that card is fake and should not exist"); its sheet
// removes it. The list is the server's (consumer-web-list-cards), read on
// mount and after every add or remove.

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

/** ONE LINE PER PENDING AMOUNT (MESITA-4360, Pato: "if 2 bonuses, then 2
 *  blue boxes … show hours and minutes, not seconds, a counter"): each
 *  pending entry, soonest first, "$1,500.00MX bonus pending · ready in 2 h
 *  14 min". It was one line with the total and the first time (MESITA-4232,
 *  D9; "ready" since MESITA-4260). */
function pendingLines(b: WalletBalance, now: number): string[] {
  if (b.pending_cents <= 0) return [];
  const rows = b.entries
    .filter((e) => e.pending && e.amount_cents > 0)
    .map((e) => ({ e, t: e.available_at ? Date.parse(e.available_at) : Number.NaN }))
    .sort((x, y) => (Number.isFinite(x.t) ? x.t : Infinity) - (Number.isFinite(y.t) ? y.t : Infinity));
  if (rows.length === 0) return [`${money(b.pending_cents, b.currency)} pending`];
  return rows.map(({ e }) => pendingWords(e.amount_cents, b.currency, e.kind, e.available_at, now));
}

export function WalletSection({
  giftToken = null,
  onReady,
}: {
  giftToken?: string | null;
  /** Told once the Wallet has painted (MESITA-4376): /pay keeps its buttons in bones until then. */
  onReady?: () => void;
}) {
  const router = useRouter();
  const getSupabase = useLazyBrowserSupabase();
  const { wallet, failed, credits, reread } = useWallet({ withCards: true });
  const [explainAdd, setExplainAdd] = useState(false);
  // The pending boxes count down (MESITA-4360): a 30 s tick while any
  // card has money on its way, so the minutes move without seconds.
  const [now, setNow] = useState(() => Date.now());
  const anyPending = (wallet?.balances ?? []).some((b) => b.pending_cents > 0);
  useEffect(() => {
    if (!anyPending) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [anyPending]);
  // Story lines turn to "Checking your story…" at their bonus time (MESITA-4264).
  const storyNow = useStoryNow(openStories(wallet?.waiting_stories ?? []));
  // The saved-card failure toast fires at most once per mount.
  const cardsToasted = useRef(false);
  // A friend's credit link (MESITA-3292) opens over the Wallet once the
  // Wallet has read; closing it leaves its address for the Wallet's.
  const [gift, setGift] = useState(giftToken);
  const closeGift = useCallback(() => {
    setGift(null);
    navigateTo(router, CONSUMER_ROUTES.pay, { replace: true });
  }, [router]);

  // Saved cards come with the Wallet's read; null means Stripe failed.
  const cards: SavedCard[] = wallet?.cards ?? [];
  const cardsFailed = wallet !== null && wallet.cards === null;
  useEffect(() => {
    if (cardsFailed && !cardsToasted.current) {
      cardsToasted.current = true;
      toast.error("Couldn't load your saved cards");
      // One more read: the card tile stays a placeholder meanwhile, never
      // a false "Add a card" (MESITA-4373).
      const id = setTimeout(reread, 2_000);
      return () => clearTimeout(id);
    }
  }, [cardsFailed, reread]);

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
  useEffect(() => {
    if (ready) onReady?.();
  }, [ready, onReady]);

  if (gift) {
    return (
      <Screen title="Credit from a friend" paper scrolls>
        <GiftClaimSheet
          token={gift}
          onClose={closeGift}
          onClaimed={() => {
            closeGift();
            reread();
          }}
        />
      </Screen>
    );
  }

  if (!ready) return <WalletBodySkeleton />;


  let shown = 0;
  // Open Stories only (MESITA-4446): a decided one lives in Tickets.
  const stories = openStories(wallet?.waiting_stories ?? []);
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
        <p className="text-muted-foreground mt-2 px-2 text-sm" role="status">
          Confirming a payment…
        </p>
      ) : null}

      {/* PAYMENT METHODS (Pato, 2026-11-20, MESITA-4475): the card only.
          Cash stays in the pay flow, not on this list. No card yet = Add a
          card; a card that has not loaded = the skeleton. */}
      <PaymentMethods>
        {cards[0] ? (
          <CardTile card={cards[0]} onOpen={() => navigateTo(router, walletCardPath(cards[0].id), { motion: "drill" })} />
        ) : cardsFailed ? (
          <CardTileSkeleton />
        ) : (
          <AddCardTile onClick={() => openAddCardModal(() => reread())} />
        )}
      </PaymentMethods>

      {/* LOYALTY CARDS (MESITA-4232, D9/D10/D13): waiting Stories as their
          place's pending, then each card with its ready pill, "Ready to
          spend" and, when money is coming, a blue pending box (MESITA-4260),
          then Add a Loyalty Card. Empty: one grey line. */}
      <WalletPanelList title="Loyalty Cards">
        {creditsState === "rows"
          ? stories.map((s) => <StoryRow key={s.purchase_id} story={s} now={storyNow} onOpen={() => navigateTo(router, storyTicketPath(s.story_id), { motion: "drill" })} />)
          : null}
        {creditsState === "rows"
          ? credits?.map((row) => (
              <CreditsRow
                key={row.card.key}
                card={row.card}
                href={row.card.tap.kind === "link" ? row.card.tap.href : placeHref(row.placeSlug)}
                gone={row.balance.place === null}
                eager={shown++ < EAGER_CARDS}
                ready
                pendingLines={pendingLines(row.balance, now)}
              />
            ))
          : null}
        {creditsState === "empty" ? <EmptyLoyaltyLine /> : null}
        {creditsState === "loading" ? <RowsSkeleton count={2} /> : null}
        {creditsState === "rows" || creditsState === "empty" ? (
          <AddRow line="Add a Loyalty Card" ariaLabel="Add a Loyalty Card" onClick={() => setExplainAdd(true)} />
        ) : null}
      </WalletPanelList>
      {creditsState === "failed" ? (
        <div className="mt-2">
          <EmptyState
            inline
            icon={WalletIcon}
            title="Couldn't load your credits"
            description="Check your connection and try again."
            action={{ label: "Try again", onClick: reread }}
          />
        </div>
      ) : null}

      {/* Add a Credits Card explains, never navigates (MESITA-4088). */}
      <AddCreditsCardDialog open={explainAdd} onClose={() => setExplainAdd(false)} />
    </div>
  );
}
