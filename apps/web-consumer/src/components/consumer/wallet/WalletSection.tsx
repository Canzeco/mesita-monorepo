"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Wallet as WalletIcon } from "lucide-react";
import { AddCreditsCardDialog } from "./AddCreditsCardDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { photoUrl } from "@mesita/place-profile";
import { Screen } from "@/components/consumer/nav/Screen";
import { CONSUMER_ROUTES, walletPlacePath } from "@/lib/consumer-route-contract";
import { navigateTo } from "@/lib/navigate";
import { toast } from "@/lib/toast";
import { PlaceActionRow } from "@/components/consumer/pay/PlaceActionRow";
import { LoyaltyCardBoxSkeleton } from "@/components/consumer/pay/PayFrameLoading";
import { PAY_ROW, PAY_ROW_TEXT, PAY_THUMB, SECTION_CARD, SECTION_ROWS, SECTION_TITLE } from "@/components/consumer/pay/pay-sections";
import { GiftClaimSheet } from "./SendCredit";
import { cn } from "@/lib/utils";
import { useWallet } from "./use-wallet";
import { money } from "@/lib/api/wallet";

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
const EMPTY_IDS: ReadonlySet<string> = new Set();
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
  onReady,
  hidePending = false,
  lead = null,
  leadIds = EMPTY_IDS,
  leadCount = 0,
  leadSettled = true,
  query = "",
}: {
  /** The place rows, first in the panel (MESITA-4497). */
  lead?: ReactNode;
  /** The places `lead` lists; null while they load. Their cards are not listed again. */
  leadIds?: ReadonlySet<string> | null;
  /** How many place rows `lead` shows now. */
  leadCount?: number;
  /** The places answered (not loading, not failed). */
  leadSettled?: boolean;
  /** The search bar's words: cards filter by name. */
  query?: string;
  giftToken?: string | null;
  /** Told once the Wallet has painted (MESITA-4376): /pay keeps its buttons in bones until then. */
  onReady?: () => void;
  /** On Pay (MESITA-4623, MESITA-4625): the cards here draw no blue pending
   *  box; Pay's own place rows carry it. */
  hidePending?: boolean;
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

  const q = fold(query.trim());
  // A place already listed above with Pay is not listed again (MESITA-4497).
  const cards = (credits ?? []).filter((r) => !leadIds?.has(r.placeId) && (!q || fold(r.card.name ?? "").includes(q)));
  // One state drives the card rows, the empty block and the error.
  const creditsState: "loading" | "failed" | "empty" | "rows" =
    failed && !wallet
      ? "failed"
      : !ready || !wallet || credits === null || leadIds === null
        ? "loading"
        : cards.length === 0
          ? "empty"
          : "rows";
  const settled = creditsState === "rows" || creditsState === "empty";

  return (
    <div className="flex flex-col" data-wallet>
      {wallet?.settling ? (
        <p className="text-muted-foreground mt-2 px-2 text-sm" role="status">
          Confirming a payment…
        </p>
      ) : null}

      {/* ONE BOX OF ROWS (MESITA-4560, /plan-design-review D1): a grey
          "Loyalty Cards" title over one white box, a hairline between places. */}
      {/* The title inside its own card on white (MESITA-4574). */}
      <section className={SECTION_CARD} aria-label="Loyalty Cards">
        <h2 className={SECTION_TITLE}>Loyalty Cards</h2>
        <div className={SECTION_ROWS}>
          {lead}
          {creditsState === "rows"
            ? cards.map((row) => {
                const gone = row.balance.place === null;
                const name = row.card.name || "A Mesita place";
                return (
                  <PlaceActionRow
                    key={row.card.key}
                    name={name}
                    photo={row.card.photo}
                    amount={gone || row.card.available_cents <= 0 ? null : money(row.card.available_cents, row.card.currency)}
                    subtitle={gone ? "Ask Mesita support to use it." : null}
                    pending={!hidePending && !gone && row.balance.pending_cents > 0 ? money(row.balance.pending_cents, row.card.currency) : null}
                    disabled={gone}
                    placeId={row.placeId}
                    onOpen={() => navigateTo(router, walletPlacePath(row.placeId), { motion: "drill" })}
                  />
                );
              })
            : null}
          {creditsState === "loading" ? (
            <>
              <LoyaltyCardBoxSkeleton />
              <LoyaltyCardBoxSkeleton />
            </>
          ) : null}
          {settled && q && leadCount === 0 && creditsState === "empty" ? (
            <p className="text-muted-foreground px-4 py-4 text-sm">No place matches “{query.trim()}”.</p>
          ) : null}
          {creditsState === "empty" && !q && leadCount === 0 && leadSettled ? (
            // One plain line (MESITA-4519): Pay Bill above opens the sheet.
            <p className="text-muted-foreground px-2 py-4 text-sm" data-wallet-empty>
              No Mesita places near you yet. Tap Pay Bill to find one.
            </p>
          ) : null}
          {/* ADD ANOTHER CARD, LAST (Pato, 2026-11-21, MESITA-4573: "in
              loyalty cards below offer option to add extra card"): one row
              in the cards' shape, opening MESITA-4088's "Loyalty Cards add
              themselves" dialog (buy credits at a place, or get a gift) with
              its Find a place. Not while the cards load or a search narrows
              the list. */}
          {creditsState !== "loading" && !q ? (
            <button
              type="button"
              onClick={() => setAddOpen(true)}
              className={PAY_ROW}
              data-wallet-add-card
            >
              <span className={cn(PAY_THUMB, "bg-muted text-foreground")} aria-hidden>
                <Plus className="h-4 w-4" strokeWidth={2.25} />
              </span>
              <span className={cn(PAY_ROW_TEXT, "min-w-0 flex-1 truncate")}>Add Loyalty Card</span>
              <ChevronRight className="text-muted-foreground h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
      </section>
      <AddCreditsCardDialog open={addOpen} onClose={() => setAddOpen(false)} />
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

/** Accents and case do not matter in the Wallet's search. */
export function fold(v: string): string {
  return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
