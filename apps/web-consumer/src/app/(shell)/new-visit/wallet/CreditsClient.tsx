"use client";

import { useEffect, useState } from "react";
import { Plus, Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { BalanceList, CARD_PX } from "@/components/consumer/credits/BalanceList";
import { BalanceDetail } from "@/components/consumer/credits/BalanceDetail";
import { BuyCreditsSheet } from "@/components/consumer/credits/BuyCreditsSheet";
import { WaysToPay } from "@/components/consumer/credits/WaysToPay";
import {
  AddCardButton,
  CardList,
  CardsDisclosure,
  useConsumerCards,
} from "@/components/consumer/me/CardList";
import type { CreditBalance } from "@/lib/mock/credits-mock";
import type { Seed } from "@/lib/mock/credits-emulator";
import { errorMessage, useCredits } from "@/lib/mock/use-credits";
import { trackEvent } from "@/lib/analytics/track";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// The Pay tab's second section, at /new-visit/wallet.
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
// MIXED LIVENESS, and the page still says which is which. The BALANCES are
// PARKED on a browser emulator — no table, no Edge Function, no place side.
// The TERMS are real: the bonus and the expiry come from the console's Controls
// page through consumer-web-get-controls-config. Cards is fully live.
//
// THE PARKED CLAIM STAYS until the balances are real (MESITA-1674). It is the
// only place the screen says these numbers are emulated, and cutting it would
// ship the prettiest version of this surface as the first one to show a guest
// MX$4,172 of restaurant money with nothing naming it as invented.

/** Title left, action top-right. The button is deliberately not small: Pato,
 *  2026-09-08 — "tiene que ser un botón un poco grande, no quiero que esté
 *  escondido". */
function SectionHead({
  title,
  action,
}: {
  title: string;
  action: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-3">
      <h2 className="text-sm font-bold">{title}</h2>
      {action}
    </div>
  );
}

// `--brand-pink-text` (pink-600, 4.77:1), NOT `--primary` (pink-500, 3.66:1)
// — this is text on a light surface and 500 fails AA. The token has no
// Tailwind utility and an arbitrary `text-[...]` trips the off-scale-font-size
// rule, so it rides an inline style. globals.css:26 documents the pair.
const ADD_BUTTON_CLASS =
  "bg-primary/10 flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-bold transition active:scale-[0.98] disabled:opacity-50";
const ADD_BUTTON_STYLE = { color: "var(--brand-pink-text)" };

export function CreditsClient({ seed }: { seed: Seed }) {
  const credits = useCredits(seed);
  const cards = useConsumerCards(true);
  const [open, setOpen] = useState<CreditBalance | null>(null);
  const [buying, setBuying] = useState(false);
  const supabase = useBrowserSupabase();

  // MESITA-1387: "whether anyone opens the Wallet" — fires once per mount,
  // regardless of how the guest arrived.
  useEffect(() => {
    trackEvent(supabase, "wallet_open", { from: "pay_section_nav" });
  }, [supabase]);

  const openBalanceCard = (balance: CreditBalance) => {
    trackEvent(supabase, "balance_card_tap", {
      balance_cents: balance.balanceCents,
    });
    setOpen(balance);
  };

  const balances = credits.state?.balances ?? [];
  const nowMs = credits.nowMs;
  // Every peso the guest has here, expired included — the Top up sheet states
  // what the wallet holds, and quietly dropping dead money would make the
  // total disagree with the cards the guest is looking at.
  const held = balances.reduce((sum, b) => sum + b.balanceCents, 0);

  // The open sheet reads from live state, not the snapshot it was opened with,
  // so a spend updates the sheet it was made from instead of going stale.
  const openBalance = open
    ? (balances.find((b) => b.id === open.id) ?? null)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-5">
        {/* Only until there is a balance — see WaysToPay's header. */}
        {!credits.loading && balances.length === 0 ? <WaysToPay /> : null}

        <section aria-label="Cards">
          <SectionHead
            title="Cards"
            action={
              <AddCardButton
                state={cards}
                label="Add"
                className={ADD_BUTTON_CLASS}
              />
            }
          />
          <CardList state={cards} />
          <CardsDisclosure mock={cards.mock} className="mt-2.5" />
        </section>

        <section aria-label="Credits">
          <SectionHead
            title="Credits"
            action={
              <button
                type="button"
                onClick={() => setBuying(true)}
                aria-label="Buy Credits"
                style={ADD_BUTTON_STYLE}
                className={ADD_BUTTON_CLASS}
              >
                <Plus className="size-4" strokeWidth={2.5} aria-hidden />
                Add
              </button>
            }
          />
          {credits.loading ? (
            // Sized from the card's own minimum so the skeleton cannot drift
            // from what lands on top of it.
            <div style={{ height: CARD_PX }}>
              <Skeleton className="h-full w-full rounded-2xl" />
            </div>
          ) : balances.length === 0 ? (
            // No `action`. EmptyState normally carries one and the rule behind
            // that is real — a zero state without a next step is a dead end.
            // It already has one here: Add sits in the header directly above.
            <EmptyState
              icon={Wallet}
              title="No Credits yet"
              description="Pay a place ahead of time and it gives you back more than you paid. Spend it there whenever you go."
            />
          ) : (
            <BalanceList
              balances={balances}
              nowMs={nowMs}
              onOpen={openBalanceCard}
            />
          )}
        </section>
      </div>

      {credits.error && (
        <p
          role="alert"
          className="text-destructive shrink-0 px-5 pb-1 text-center text-xs"
        >
          {errorMessage(credits.error)}
        </p>
      )}

      {/* The parked claim, and nothing else. See the header: this line is the
          only place the screen states that the balances are emulated, so it
          does not get shortened away. */}
      <div className="border-border shrink-0 border-t px-5 py-3">
        <p className="text-muted-foreground/80 type-label">
          Emulated &middot; Credits aren&rsquo;t live yet.
        </p>
      </div>

      <BuyCreditsSheet
        open={buying}
        onClose={() => setBuying(false)}
        onBuy={credits.buy}
        busy={credits.busy}
        policy={credits.policy}
        heldCents={held}
      />

      <BalanceDetail
        balance={openBalance}
        nowMs={nowMs}
        busy={credits.busy}
        onSpend={credits.spend}
        onClose={() => setOpen(null)}
      />
    </div>
  );
}
