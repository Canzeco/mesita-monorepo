"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { BalanceList, CARD_PX } from "@/components/consumer/credits/BalanceList";
import { WaysToPay } from "@/components/consumer/credits/WaysToPay";
import { WalletPanel } from "@/components/consumer/wallet/WalletPanel";
import {
  AddCardButton,
  CardList,
  CardsDisclosure,
  useConsumerCards,
} from "@/components/consumer/me/CardList";
import type { CreditOrgBalance } from "@/lib/api/credits";
import { useCreditBalances } from "@/lib/use-credit-balances";
import {
  CONSUMER_ROUTES,
  walletBalancePath,
} from "@/lib/consumer-route-contract";
import { trackEvent } from "@/lib/analytics/track";
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
// THE DECK IS GONE, THE CARD IS NOT. See BalanceList: org scope, pending lots
// and twenty balances each break an overlapping deck on their own, but the
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

/** ACTION BUTTONS, DELIBERATELY NOT SMALL: Pato, 2026-09-08 — "un botón un
 *  poco grande, no quiero que esté escondido", then "make the buttons larger".
 *
 *  CARDS TAKES ONE ACTION, CREDITS TAKES THREE, and the widths were measured
 *  rather than hoped for. At `text-sm` bold with `px-4`, "Credits" plus Buy,
 *  Gift and Redeem and their gaps is ~274px inside the 335px a 375px phone
 *  leaves after the page gutter — and the panel now eats 32px more in its own
 *  padding, so the row wraps its buttons rather than clipping them. It fits
 *  only with the icons gone, which is why no section button carries a glyph,
 *  including Cards' Add, where the word already says what the button does. */

// `--brand-pink-text` (pink-600, 4.77:1), NOT `--primary` (pink-500, 3.66:1)
// — this is text on a light surface and 500 fails AA. The token has no
// Tailwind utility and an arbitrary `text-[...]` trips the off-scale-font-size
// rule, so it rides an inline style. globals.css:26 documents the pair.
const ADD_BUTTON_CLASS =
  "bg-primary/10 flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2.5 text-sm font-bold transition active:scale-[0.98] disabled:opacity-50";
const ADD_BUTTON_STYLE = { color: "var(--brand-pink-text)" };

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

  const openBalanceCard = (balance: CreditOrgBalance) => {
    trackEvent(supabase, "balance_card_tap", {
      balance_cents: balance.spendableCents,
    });
    router.push(walletBalancePath(balance.organizationId));
  };

  const loadMore = () => {
    trackEvent(supabase, "wallet_load_more_tap", {
      shown: balances.length,
    });
    void credits.loadMore();
  };

  const balances = credits.organizations;
  // 0, not Date.now(): calling an impure function during render is rejected
  // outright (react-hooks/purity), and this fallback is never actually
  // shown — useCreditBalances sets nowMs in the same call that sets
  // `organizations`, so by the time balances.length > 0 renders below, nowMs
  // is already real.
  const nowMs = credits.nowMs ?? 0;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 py-5">
        {/* Always. Not "until it has been read" — see WaysToPay's header. */}
        <WalletPanel title="Ways to pay">
          <WaysToPay />
        </WalletPanel>

        <WalletPanel
          title="Cards"
          actions={
            <AddCardButton
              state={cards}
              label="Add"
              className={ADD_BUTTON_CLASS}
            />
          }
        >
          <CardList state={cards} />
          <CardsDisclosure mock={cards.mock} className="mt-2.5" />
        </WalletPanel>

        <WalletPanel
          title="Credits"
          // BUY · GIFT · REDEEM (Pato, 2026-09-08). Add named the mechanic;
          // Buy names the act. Redeem is global BY NECESSITY — it is the door
          // for someone who was given Credits and holds nothing, so a
          // per-balance Redeem is unreachable by definition. Gift is global
          // because gifting is ISSUANCE (MESITA-1677): you buy a balance for
          // someone else, so it starts by choosing an organization exactly as
          // Buy does and needs no source balance selected first.
          actions={
            <>
              <HeadAction href={CONSUMER_ROUTES.newVisit.walletBuy}>
                Buy
              </HeadAction>
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
            // from what lands on top of it.
            <div style={{ height: CARD_PX }}>
              <Skeleton className="h-full w-full rounded-2xl" />
            </div>
          ) : balances.length === 0 ? (
            // No `action`. EmptyState normally carries one and the rule behind
            // that is real — a zero state without a next step is a dead end.
            // It already has one here: Buy sits in the header directly above.
            <EmptyState
              icon={Wallet}
              title="No Credits yet"
              description="Pay a place ahead of time and it gives you back more than you paid. Spend it there whenever you go."
            />
          ) : (
            <>
              <BalanceList
                balances={balances}
                nowMs={nowMs}
                onOpen={openBalanceCard}
              />
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
        </WalletPanel>
      </div>

      {credits.error && (
        <p
          role="alert"
          className="text-destructive shrink-0 px-5 pb-1 text-center text-xs"
        >
          {credits.error}
        </p>
      )}
    </div>
  );
}
