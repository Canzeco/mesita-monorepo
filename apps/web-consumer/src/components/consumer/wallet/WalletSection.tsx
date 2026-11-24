"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Wallet as WalletIcon } from "lucide-react";
import { AddCreditsCardDialog } from "./AddCreditsCardDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { photoUrl } from "@mesita/place-profile";
import { Screen } from "@/components/consumer/nav/Screen";
import { CONSUMER_ROUTES, walletPlacePath, walletSendPath } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { toast } from "@/lib/toast";
import { PlaceActionRow } from "@/components/consumer/pay/PlaceActionRow";
import { Skeleton } from "@/components/shared/Skeleton";
import { PAY_ROW, PAY_ROW_TEXT, PAY_THUMB } from "@/components/consumer/pay/pay-sections";
import { GiftClaimSheet } from "./SendCredit";
import { cn } from "@/lib/utils";
import { useWallet } from "./use-wallet";
import { money } from "@/lib/api/wallet";

/** The soonest time a pending entry here turns Available (MESITA-4644). */
function soonestPendingAt(entries: { pending: boolean; available_at?: string | null }[]): string | null {
  let best: string | null = null;
  for (const e of entries) {
    if (!e.pending || !e.available_at) continue;
    if (best === null || Date.parse(e.available_at) < Date.parse(best)) best = e.available_at;
  }
  return best;
}

// ONE PANEL, EACH PLACE ONCE (Pato, 2026-11-20, MESITA-4497, after a
// /plan-design-review of MESITA-4485/4492): Pay hands this its place rows
// (`lead`); a card whose place is listed there is not drawn again, the rest
// follow as the same cards (MESITA-4519: no Add a Loyalty Card row, each
// card with its offers). The place rows show at once;
// the card rows are bones until the Wallet's read paints. The notes below
// are the history.
//
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
// Payment Methods: a CreditsRow per place (its
// Loyalty Card on tap), "Find a place" when there is none. No black band,
// transactions or Fund | Gift here any more: Buy Credits, Send Gift, Go
// to Pay and the history are on the Loyalty Card page (PlaceCredit). The
// notes below are the history.
//
// MONEY FIRST, CREDITS CARDS WITH THEIR TRANSACTIONS (Pato, 2026-11-11,
// MESITA-3736, /plan-design-review, every choice his: "money payment methods
// on top, and card payment methods on bottom. each card must have the
// transactions and a button to add funds (prepay) and a button to gift
// funds"): Money Payment Methods first, then Credits Payment Methods: one
// CreditsCard per place (a black band, its 3 newest
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
//     each Credits Card with its Fund | Gift footer
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
// /wallet/place/<placeId> (MESITA-3614); a saved card opens its sheet here. The money is useWallet's (consumer-web-get-wallet).
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

// PAY'S LOYALTY CARDS TAB (Pato, 2026-11-23, MESITA-4765: "loyalty cards at
// the right you are going to display, well, the loyalty cards"): only the
// cards, then Add Loyalty Card; the tab names the box, so it has no title.
// The nearby places that led the box (MESITA-4497) are the Nearby Offers tab,
// so every card is listed here and draws its own pending box.
export function WalletSection({
  giftToken = null,
  onReady,
}: {
  giftToken?: string | null;
  /** Told once the Wallet has painted (MESITA-4376): /pay keeps its buttons in bones until then. */
  onReady?: () => void;
}) {
  const router = useRouter();
  const { wallet, failed, credits, reread } = useWallet({ withCards: true });
  // The saved-card failure toast fires at most once per mount.
  const cardsToasted = useRef(false);
  // A friend's credit link (MESITA-3292) opens over the Wallet once the
  // Wallet has read; closing it leaves its address for the Wallet's.
  const [addOpen, setAddOpen] = useState(false);
  const [gift, setGift] = useState(giftToken);
  const closeGift = useCallback(() => {
    setGift(null);
    navigateTo(router, CONSUMER_ROUTES.pay, { replace: true });
  }, [router]);

  // Saved cards come with the Wallet's read; null means Stripe failed.
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

  const cards = credits ?? [];
  // One state drives the card rows and the error.
  const creditsState: "loading" | "failed" | "empty" | "rows" =
    failed && !wallet ? "failed" : !ready || !wallet || credits === null ? "loading" : cards.length === 0 ? "empty" : "rows";

  return (
    <div className="flex flex-col" data-wallet>
      {wallet?.settling ? (
        <p className="text-muted-foreground px-3 py-2 text-sm" role="status">
          Confirming a payment…
        </p>
      ) : null}

      {/* CARDS ON THE MENU'S WHITE PANEL (MESITA-4839), 10px apart; rows
          with a hairline for one deploy (MESITA-4838). */}
      <div className="flex flex-col gap-2.5 p-2.5">
        {creditsState === "rows"
          ? cards.map((row) => {
              const gone = row.balance.place === null;
              const name = row.card.name || "A Mesita place";
              return (
                <PlaceActionRow
                  key={row.card.key}
                  name={name}
                  photo={row.card.photo}
                  amount={money(Math.max(row.card.available_cents, 0), row.card.currency)}
                  subtitle={gone ? "Ask Mesita support to use it." : null}
                  pending={!gone && row.balance.pending_cents > 0 ? money(row.balance.pending_cents, row.card.currency) : null}
                  pendingAt={soonestPendingAt(row.balance.entries)}
                  disabled={gone}
                  placeId={row.placeId}
                  giftHref={!gone && wallet?.can_send === true && row.card.available_cents > 0 ? walletSendPath(row.placeId) : null}
                  onOpen={() => navigateTo(router, walletPlacePath(row.placeId), { motion: "drill" })}
                />
              );
            })
          : null}
        {creditsState === "loading" ? (
          <>
            <Skeleton className="h-40 w-full rounded-2xl" aria-hidden />
            <Skeleton className="h-40 w-full rounded-2xl" aria-hidden />
          </>
        ) : null}
        {/* ADD ANOTHER CARD, LAST (Pato, 2026-11-21, MESITA-4573: "in
            loyalty cards below offer option to add extra card"): one row in
            the cards' shape, opening MESITA-4088's "Loyalty Cards add
            themselves" dialog. With no card it is the tab's one row
            (MESITA-4765, D5). Not while the cards load. */}
        {creditsState !== "loading" ? (
          <button type="button" onClick={() => setAddOpen(true)} className={cn(PAY_ROW, "bg-muted hover:bg-foreground/10 rounded-2xl")} data-wallet-add-card>
            <span className={cn(PAY_THUMB, "bg-card text-foreground")} aria-hidden>
              <Plus className="h-4 w-4" strokeWidth={2.25} />
            </span>
            <span className={cn(PAY_ROW_TEXT, "min-w-0 flex-1 truncate")}>Add Loyalty Card</span>
            <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
          </button>
        ) : null}
      </div>
      <AddCreditsCardDialog open={addOpen} onClose={() => setAddOpen(false)} />
      {creditsState === "failed" ? (
        <div className="p-3">
          <EmptyState
            inline
            icon={WalletIcon}
            title="Couldn't load your credits"
            description="Check your connection and try again."
            action={{ label: "Try again", onClick: reread }}
          />
        </div>
      ) : null}

    </div>
  );
}

/** A row's money (MESITA-4497): what is ready in plain bold, then each
 *  pending amount on its own grey line. No pill: Pay is the row's one black thing. */
export function BalanceLines({ available, pending }: { available: string | null; pending: string[] }) {
  if (!available && pending.length === 0) return null;
  return (
    <span className="mt-0.5 block text-sm leading-tight tabular-nums">
      {available ? <span className="text-foreground block font-semibold">{available}</span> : null}
      {pending.map((line, i) => (
        <span key={i} className="text-muted-foreground block truncate">
          {line}
        </span>
      ))}
    </span>
  );
}
