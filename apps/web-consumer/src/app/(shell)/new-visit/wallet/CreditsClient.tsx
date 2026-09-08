"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Plus, Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import {
  BalanceStack,
  CARD_PX,
  PEEK_PX,
} from "@/components/consumer/credits/BalanceStack";
import { BalanceDetail } from "@/components/consumer/credits/BalanceDetail";
import { BuyCreditsSheet } from "@/components/consumer/credits/BuyCreditsSheet";
import { CardsModal } from "@/components/consumer/me/CardsModal";
import type { CreditBalance } from "@/lib/mock/credits-mock";
import type { Seed } from "@/lib/mock/credits-emulator";
import { errorMessage, useCredits } from "@/lib/mock/use-credits";
import { trackEvent } from "@/lib/analytics/track";
import { useBrowserSupabase } from "@/lib/supabase/browser";

// The Pay tab's second section, at /new-visit/wallet.
//
// THE SECTION IS A CONTAINER, NOT A CURRENCY (Pato, 2026-08-31). It was called
// Credits while per-place prepaid balances were the only thing on it. It now
// holds the Credits deck, the saved payment methods that were buried in
// Me › More › Cards, and gifting — so naming it after one of them was the
// mistake a container name exists to prevent. Credits stays the word for the
// MONEY: 🪙 Credits §D is untouched, `places.credits_enabled` and
// `visits_config.payCredits` are untouched.
//
// THE DECK IS THE SCREEN (Pato, 2026-09-02: "a lot cleaner, more minimalistic,
// must feel like an Apple Wallet"). This surface used to run SIX chrome systems
// at once — the section pill row, the photo cards, two bordered action tiles, an
// eyebrow section label, a bordered settings row, and a demo bar carrying a
// two-line paragraph. Apple runs one, cards, plus a ＋. It runs two now: the
// deck and two hairline rows. What left, and why:
//
//   · THE TOTAL LINE. It led a screen it is not the subject of, wrapped to two
//     lines at 390px, and described money that cannot be spent anywhere — the
//     same objection that killed the pink hero before it. The deck states every
//     balance at rest now, so the sum is derivable; where you would ACT on it,
//     the Top up sheet, is where it moved.
//   · BOTH ACTION TILES. A bordered box with an icon in a tinted rounded square,
//     a bold title and a two-line summary, repeated symmetrically, is the most
//     recognisable generated-UI layout there is. Top up is a row. Gift is gone
//     entirely: a control that cannot be pressed is decoration, not discovery,
//     and the instrument's giftability lives in the model, not in a dead chip.
//   · "ALSO IN YOUR WALLET" AND THE BORDERED ROW UNDER IT. One eyebrow over one
//     row is a section label for a section of one. Payment methods is a plain
//     row with a chevron — still a button, still keyboard-reachable, and the
//     chevron is the affordance iOS already taught everyone to read.
//
// THE ROWS SIT DIRECTLY UNDER THE DECK, not pinned to the bottom. Bottom-anchored
// they leave ~200px of nothing in the MIDDLE of the screen, which reads as a gap;
// under the deck the same emptiness falls at the bottom, where it reads as calm.
// Proximity: the actions belong to the deck.
//
// THIS IS THE SECOND BOUNDED CARVE-OUT ON THIS SCREEN. `BalanceCard`'s photo
// face is the first (CLAUDE.md names it). Border-less rows are a deviation from
// the app's one list-row look and they stop at this file.
//
// MIXED LIVENESS, and the page still says which is which. The Credits BALANCES
// are PARKED on a browser emulator — no table, no Edge Function, no place side.
// The TERMS are real: the bonus and the expiry come from the console's Controls
// page through consumer-web-get-controls-config. Payment methods is fully live
// and opens the real Stripe-backed CardsModal.
//
// AND THE PARKED CLAIM OUTLIVED THE DEMO CLOCK. A strip of +1h/+24h/+30d buttons
// used to sit at the foot of this screen, there to walk a balance out of its
// hold; the hold is gone (Pato, 2026-09-08: Credits are active the moment they
// are bought) and the buttons went with it. Its CAPTION did not. It is the only
// place the screen says these balances are not real, and cutting it would ship
// the prettiest version of this surface as the first one to show a guest
// MX$4,172 of restaurant money with nothing naming it as emulated.
//
// NO IN-BODY TITLE. Every section opens straight into its content; the pill
// row directly above already says which one this is.

export function CreditsClient({ seed }: { seed: Seed }) {
  const credits = useCredits(seed);
  const [open, setOpen] = useState<CreditBalance | null>(null);
  const [buying, setBuying] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);
  const supabase = useBrowserSupabase();

  // MESITA-1387: "whether anyone opens the Wallet" — fires once per mount,
  // regardless of how the guest arrived (the pill row is the only path
  // today, but a redirect or a back-button return should count the same).
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
  // what the wallet holds, and quietly dropping dead money would make the total
  // disagree with the deck the guest is looking at.
  const held = balances.reduce((sum, b) => sum + b.balanceCents, 0);

  // The open sheet reads from live state, not the snapshot it was opened with,
  // so a spend updates the sheet it was made from instead of going stale.
  const openBalance = open
    ? (balances.find((b) => b.id === open.id) ?? null)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {credits.loading ? (
          // Derived from the deck's own minimums, so it cannot drift from what
          // lands on top of it: two peeks and one open card.
          <div className="px-5 pt-5" style={{ height: PEEK_PX * 2 + CARD_PX }}>
            <Skeleton className="h-full w-full rounded-2xl" />
          </div>
        ) : balances.length === 0 ? (
          // No `action`. EmptyState normally carries one, and the rule behind
          // that is real — a zero state without a next step is a dead end. It
          // already has one here: the Top up row renders directly below, on
          // every state of this screen.
          <EmptyState
            icon={Wallet}
            title="No Credits yet"
            description="Pay a place ahead of time and it gives you back more than you paid. Spend it there whenever you go."
          />
        ) : (
          <div className="px-5 pt-5">
            <BalanceStack balances={balances} nowMs={nowMs} onOpen={openBalanceCard} />
          </div>
        )}

        {/* mt-4: the first hairline sits flush against the deck's bottom edge
            otherwise, which reads as the card having a border rather than the
            list having a rule. */}
        <div className="mt-4 px-5">
          <div className="border-border border-t">
            <button
              type="button"
              onClick={() => setBuying(true)}
              // `--brand-pink-text` (pink-600, 4.77:1), NOT `--primary`
              // (pink-500, 3.66:1) — this is body text and 500 fails AA. The
              // token has no Tailwind utility, and an arbitrary `text-[...]`
              // trips the off-scale-font-size rule, so it rides an inline
              // style. globals.css:26 documents the pair.
              style={{ color: "var(--brand-pink-text)" }}
              className="flex min-h-[52px] w-full items-center gap-2.5 py-4 text-left text-sm font-bold transition active:scale-[0.99]"
            >
              <Plus className="h-[18px] w-[18px] shrink-0" strokeWidth={2.5} />
              Top up
            </button>
          </div>
          <div className="border-border border-t">
            <button
              type="button"
              onClick={() => setCardsOpen(true)}
              className="flex min-h-[52px] w-full items-center gap-3 py-4 text-left text-sm font-semibold transition active:scale-[0.99]"
            >
              Payment methods
              <ChevronRight className="text-muted-foreground ml-auto h-4 w-4 shrink-0" />
            </button>
          </div>
        </div>
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
          Emulated · Credits aren&rsquo;t live yet.
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

      {/* The SAME sheet Me › More › Cards opens — imported, not reimplemented,
          so the live Stripe flow has exactly one definition. Two doorways to
          one sheet is the shape this app already uses for Credits and Share. */}
      <CardsModal open={cardsOpen} onClose={() => setCardsOpen(false)} />

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
