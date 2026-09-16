"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/shared/Skeleton";
import { BalanceList, CARD_PX } from "@/components/consumer/credits/BalanceList";
import { WaysToPay } from "@/components/consumer/credits/WaysToPay";
import {
  WalletMoney,
  WalletPanel,
  WalletPanelEmpty,
} from "@/components/consumer/wallet/WalletPanel";
import {
  AddCardButton,
  CardList,
  CardsDisclosure,
  useConsumerCards,
} from "@/components/consumer/me/CardList";
import type { CreditPlaceBalance } from "@/lib/api/credits";
import { formatCurrency } from "@/lib/api/profile";
import { useCreditBalances } from "@/lib/use-credit-balances";
import {
  CONSUMER_ROUTES,
  walletBalancePath,
} from "@/lib/consumer-route-contract";
import { trackEvent } from "@/lib/analytics/track";
import { toast } from "@/lib/toast";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// The Pay tab's second section, at /new-visit/wallet.
//
// REAL BALANCES (MESITA-1674). This screen read a browser emulator
// (src/lib/mock/*, deleted this issue) until now; it reads
// consumer-web-list-credit-balances through useCreditBalances instead, and
// the "Emulated" footer that used to be the only place this screen admitted
// the numbers were invented is gone with it — the number on screen is a real
// one now, so there is nothing left to disclaim.
//
// THE SECTION IS A CONTAINER, NOT A CURRENCY (Pato, 2026-08-31). It was called
// Credits while per-place prepaid balances were the only thing on it. It now
// holds the balances, the saved payment methods that were buried in
// Me › More › Cards, and gifting — so naming it after one of them was the
// mistake a container name exists to prevent. Credits stays the word for the
// MONEY: 🪙 Credits §D is untouched, `places.credits_enabled` and
// `visits_config.payCredits` are untouched.
//
// THREE BLOCKS, IN THIS ORDER (Pato, 2026-09-08, re-drawn after seeing the
// shipped screen): Ways to pay · Cards · Credits.
//
// AND THEY ARE THREE OF THE SAME OBJECT (Pato, 2026-09-08: "Put in boxes,
// modularize"). Ways to pay used to be a bordered card and the other two were
// bare headings with content under them — three blocks wearing two chrome
// systems, and the two that hold the guest's money had none. All three now
// mount `WalletPanel`: title, actions and body inside one surface. This file
// owns no section chrome any more, which is what makes a fourth section a
// mount rather than a paste.
//
// AT THREE DIFFERENT RANKS (MESITA-1825, Pato: "make the design far cleaner,
// more modular, wtdf is that" — the second time those words landed on this
// screen). One object was read as one LOOK, so the fix for the first "wtf"
// shipped three identical boxes with three identical whisper-legends, and
// nothing on the screen led. Same object, three `chrome` values now:
//
//   Ways to pay  none    label, no box — read once, never again
//   Cards        flat    a real section, quietly
//   Credits      raised  the money; the only lifted surface here
//
// `WalletPanel` still renders the `<section>` and the heading at every rung,
// so the bottom rung loses its box WITHOUT losing its landmark — and this file
// still owns no chrome, which is the whole point of the prop living there.
//
// ORDER SURVIVED THE REDESIGN UNTOUCHED. It was put to Pato on 2026-09-13
// with the alternative drawn, and he kept it. Rank is carried by weight
// precisely BECAUSE it cannot be carried by position: see below.
//
// WAYS TO PAY IS PERMANENT NOW. It used to render only while the guest held
// zero balances. Pato's wireframe draws it above a wallet that has them, so
// the condition is gone — see WaysToPay's header for why the block being read
// once is not a reason to delete it once it is true.
//
// CARDS SITS ABOVE CREDITS, and that is deliberate rather than an oversight.
// Both design passes on this plan argued the opposite — the guest's own money
// should lead the screen they opened to check it. Pato's reason for the other
// order is a product reason and it wins: Credits must never read as REQUIRED.
// Putting the ordinary way to pay first is what says the prepaid balance
// underneath it is optional. That fear is the whole reason Pay was cut from
// the wallet's main actions in the first place.
//
// THE DECK IS GONE, THE CARD IS NOT. See BalanceList: pending lots and twenty
// balances each break an overlapping deck on their own, but the
// contrast engineering and the display-face numerals live in `BalanceCard` and
// are untouched. What was deleted is the pile, not the object.
//
// CARDS IS RENDERED INLINE, NOT BEHIND A ROW. It used to be a hairline row
// with a chevron that opened `CardsModal`. A section the guest is being told,
// two inches above, that they can pay with should not then be a door — and the
// header needs its own Add button, which a row cannot carry. The sheet still
// exists for Me's door; both mount `CardList` (MESITA-1672), so the live
// Stripe flow still has exactly one definition.
//
// EVERYTHING THIS SCREEN OPENS IS A ROUTE NOW (Pato, 2026-09-08: "not modals
// but actually views with full-screen with own screen"). Buy, Gift, Redeem and
// one balance were sheets mounted from this file's own state; they are four
// pages under /new-visit/wallet/ and this file holds no overlay state at all.
// The wallet is a LIST plus four doors. See newVisit.walletBuy in the route
// contract for the reversal, and WalletScreen for the frame they share.

/** SECTION ACTIONS ARE LINKS, NOT PILLS (MESITA-1825 D4). MESITA-1708 D4 took
 *  Buy out of the pill row and made it the one solid button; it did not touch
 *  what was left, so the screen still carried four filled pink shapes in three
 *  tints — Add, Gift, Redeem and Buy — and the eye read them as four peers.
 *  They are not peers. Gift and Redeem are doors most guests never open, and
 *  `--primary`'s tint on them was competing with the only button that creates
 *  anything.
 *
 *  So the fill is gone from all three. The word stays bold and pink, which is
 *  what still says "pressable" once the shape is gone.
 *
 *  THE HIT BOX DOES NOT SHRINK WITH THE SHAPE. MESITA-1708 D5 measured the
 *  44px floor on these very buttons, and a link that looks like text is the
 *  easiest place to lose it. `py-3` around a `text-sm` line is 44px, and the
 *  negative margin keeps the enlarged box from pushing the word off the
 *  header's baseline. Padding is not decoration here — deleting it breaks a
 *  measured rule.
 *
 *  `--brand-pink-text` (pink-600, 4.77:1), NOT `--primary` (pink-500, 3.66:1):
 *  this is text on a light surface and 500 fails AA — which matters more now
 *  that the text IS the button. The token has no Tailwind utility and an
 *  arbitrary `text-[...]` trips the off-scale-font-size rule, so it rides an
 *  inline style. globals.css:26 documents the pair. */
const ADD_BUTTON_CLASS =
  "-mx-1 flex shrink-0 items-center gap-1 rounded-lg px-1 py-3 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50";
const ADD_BUTTON_STYLE = { color: "var(--brand-pink-text)" };

/** THE ONE SOLID BUTTON ON THE SCREEN (MESITA-1708 D4). Buy used to be the
 *  first of three identical pink pills beside Gift and Redeem. It is not their
 *  peer: buying is the only act on this surface that creates anything, and
 *  Redeem — which most guests will never use — was carrying the same weight.
 *  `--primary` is fine as a FILL (the AA problem is pink-500 as text on white,
 *  which is why the links opposite ride --brand-pink-text instead).
 *
 *  FULL WIDTH (MESITA-1825). It sat left-aligned at the bottom of the third of
 *  three equal boxes, which is the least-looked-at pixel on the screen. Now
 *  that its panel is the only lifted one, the button spans it: one solid shape
 *  on the whole surface, and it is the shape that starts the only thing this
 *  screen can create. */
const BUY_BUTTON_CLASS =
  "bg-primary text-primary-foreground flex w-full items-center justify-center rounded-full px-5 py-3.5 text-sm font-bold shadow-rest transition active:scale-[0.98]";

/** A section header action that goes somewhere. Every one of them does now —
 *  the `SoonAction` placeholder that held Gift and Redeem for one afternoon is
 *  gone, along with the reason for it: both have real screens. */
function HeadAction({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={ADD_BUTTON_STYLE} className={ADD_BUTTON_CLASS}>
      {children}
    </Link>
  );
}

export function CreditsClient() {
  const credits = useCreditBalances();
  const cards = useConsumerCards(true);
  const router = useRouter();
  const supabase = useBrowserSupabase();

  // MESITA-1387: "whether anyone opens the Wallet" — fires once per mount,
  // regardless of how the guest arrived.
  useEffect(() => {
    trackEvent(supabase, "wallet_open", { from: "pay_section_nav" });
  }, [supabase]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cards = params.get("cards");
    if (cards === "added") toast.success("Card saved.");
    else if (cards === "cancelled") toast("Card setup cancelled.");
  }, []);

  const openBalanceCard = (balance: CreditPlaceBalance) => {
    trackEvent(supabase, "balance_card_tap", {
      balance_cents: balance.spendableCents,
    });
    router.push(walletBalancePath(balance.placeId));
  };

  const loadMore = () => {
    trackEvent(supabase, "wallet_load_more_tap", {
      shown: balances.length,
    });
    void credits.loadMore();
  };

  const balances = credits.balances;
  // 0, not Date.now(): calling an impure function during render is rejected
  // outright (react-hooks/purity), and this fallback is never actually
  // shown — useCreditBalances sets nowMs in the same call that sets
  // `balances`, so by the time balances.length > 0 renders below, nowMs
  // is already real.
  const nowMs = credits.nowMs ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        {/* Always. Not "until it has been read" — see WaysToPay's header.
            `chrome="none"` is the bottom rung: it keeps its label, its section
            and its landmark, and loses the box. A block the guest reads once
            should not spend the first viewport looking as important as the two
            underneath it that hold their money. */}
        <WalletPanel title="Ways to pay" chrome="none">
          <WaysToPay />
        </WalletPanel>

        <WalletPanel
          title="Cards"
          actions={
            <AddCardButton
              state={cards}
              label="Add"
              className={ADD_BUTTON_CLASS}
              style={ADD_BUTTON_STYLE}
            />
          }
        >
          <CardList state={cards} />
          <CardsDisclosure mock={cards.mock} className="mt-2.5" />
        </WalletPanel>

        <WalletPanel
          title="Credits"
          // THE ONLY LIFTED SURFACE ON THE SCREEN (MESITA-1825). Order is
          // locked — Credits stays third (Pato, 2026-09-13, when offered the
          // reversal) — so rank has to come from somewhere other than
          // position, and `shadow-rest` is it. One raised panel is a ladder;
          // two would be back to no ladder at all.
          chrome="raised"
          // GIFT · REDEEM in the header; BUY is not here (MESITA-1708 D4) —
          // it is the panel's own primary button, below, because it is the
          // only one of the three that creates anything. Redeem is global
          // BY NECESSITY — it is the door
          // for someone who was given Credits and holds nothing, so a
          // per-balance Redeem is unreachable by definition. Gift is global
          // because gifting is ISSUANCE (MESITA-1677): you buy a balance for
          // someone else, so it starts by choosing a place exactly as Buy
          // does and needs no source balance selected first.
          actions={
            <>
              <HeadAction href={CONSUMER_ROUTES.newVisit.walletGift}>
                Gift
              </HeadAction>
              <HeadAction href={CONSUMER_ROUTES.newVisit.walletRedeem}>
                Redeem
              </HeadAction>
            </>
          }
        >
          {credits.loading ? (
            // Sized from the card's own minimum so the skeleton cannot drift
            // from what lands on top of it — and, since MESITA-1825, from the
            // MONEY LINE too. Skeletoning only the card height meant the
            // 36px figure above it popped in from nothing on every load, which
            // is the one element on the screen the eye is already aimed at.
            <>
              <div className="mb-4">
                <Skeleton className="h-9 w-32 rounded-lg" />
                <Skeleton className="mt-2.5 h-3 w-24 rounded" />
              </div>
              <div style={{ height: CARD_PX }}>
                <Skeleton className="h-full w-full rounded-2xl" />
              </div>
            </>
          ) : balances.length === 0 ? (
            // `WalletPanelEmpty`, not the shared screen-scale `EmptyState` —
            // see its header. The old one nested a tinted icon tile and a
            // display headline inside this bordered panel, which is a
            // container wrapping a container wrapping nothing.
            //
            // NO NUMBERS IN THIS COPY. The real bonus and expiry live in
            // `controls_config` and only BuyClient fetches them; hardcoding
            // "5% · 90 days" here would be the screen asserting terms the
            // operator can change, and adding an EF call to every wallet open
            // for one sentence is not worth it. Buy states the real terms.
            //
            // THE ZERO IS THE HEADLINE (MESITA-1825). `formatCurrency(0)` is
            // "MX$0", and printing it is the point: the screen used to open on
            // a bold sentence and no amount anywhere, on a surface whose whole
            // subject is an amount. A guest with nothing saved is still owed
            // the number — "you have zero" is an answer, "no items found" is
            // not. It is also the only figure here that is honest; see
            // WalletMoney for why the non-empty case shows none.
            <div className="flex flex-col gap-2.5">
              <WalletMoney
                amount={formatCurrency(0)}
                caption="No balances yet"
              />
              <WalletPanelEmpty
                description="Prepay a place and get more than you paid. The place sets the bonus and how long it lasts."
                action={
                  <Link
                    href={CONSUMER_ROUTES.newVisit.walletBuy}
                    className={BUY_BUTTON_CLASS}
                  >
                    Buy Credits
                  </Link>
                }
              />
            </div>
          ) : (
            <>
              <BalanceList
                balances={balances}
                nowMs={nowMs}
                onOpen={openBalanceCard}
              />
              <Link
                href={CONSUMER_ROUTES.newVisit.walletBuy}
                className={`${BUY_BUTTON_CLASS} mt-3.5`}
              >
                Buy Credits
              </Link>
              {credits.hasMore ? (
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={credits.loadingMore}
                  className="text-muted-foreground hover:text-foreground mt-3 w-full rounded-2xl py-2.5 text-center text-sm font-bold transition disabled:opacity-50"
                >
                  {credits.loadingMore ? "Loading…" : "Show more"}
                </button>
              ) : null}
            </>
          )}

          {/* IN THE PANEL THAT FAILED (MESITA-1825 D5). This used to be a red
              line pinned to the bottom edge of the SCREEN, two panels away
              from the only read that can produce it — so a failed balance
              fetch announced itself under the tab bar while Credits sat
              looking merely empty. An error belongs where its content would
              have been. */}
          {credits.error ? (
            <p role="alert" className="text-destructive type-body mt-3">
              {credits.error}
            </p>
          ) : null}
        </WalletPanel>
      </div>
    </div>
  );
}
