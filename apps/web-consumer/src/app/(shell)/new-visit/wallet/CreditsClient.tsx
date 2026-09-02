"use client";

import { useState } from "react";
import { ChevronRight, Plus, RotateCcw, Wallet } from "lucide-react";
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
import {
  isExpired,
  isLocked,
  type CreditBalance,
} from "@/lib/mock/credits-mock";
import type { Seed } from "@/lib/mock/credits-emulator";
import { errorMessage, useCredits } from "@/lib/mock/use-credits";

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
// two-line paragraph. Apple runs one, cards, plus a ＋. It runs three now: the
// deck, two hairline rows, the demo strip. What left, and why:
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
// under the deck the same emptiness falls at the bottom beside the demo strip,
// where it reads as calm. Proximity: the actions belong to the deck.
//
// THIS IS THE SECOND BOUNDED CARVE-OUT ON THIS SCREEN. `BalanceCard`'s photo
// face is the first (CLAUDE.md names it). Border-less rows are a deviation from
// the app's one list-row look and they stop at this file.
//
// MIXED LIVENESS, and the page still says which is which. The Credits BALANCES
// are PARKED on a browser emulator — no table, no Edge Function, no venue side.
// The TERMS are real: the hold and the bonus come from the console's Controls
// page through consumer-web-get-controls-config. Payment methods is fully live
// and opens the real Stripe-backed CardsModal.
//
// AND THE PARKED CLAIM SURVIVED THE CLEANUP. The SOON pill rode the total line
// and the other rode the Gift tile, so cutting both would have shipped the
// prettiest version of this screen as the first one that shows a guest MX$4,172
// of restaurant money with nothing saying it is emulated. The demo strip carries
// it now, in one line: nothing live has a +24h button, and the caption names it.
//
// NO IN-BODY TITLE. Every section opens straight into its content; the pill
// row directly above already says which one this is.

/** The demo clock's rungs, in hours. One per scale the terms are written in. */
const CLOCK_RUNGS = [
  { hours: 1, label: "+1h" },
  { hours: 24, label: "+24h" },
  { hours: 24 * 30, label: "+30d" },
];

export function CreditsClient({ seed }: { seed: Seed }) {
  const credits = useCredits(seed);
  const [open, setOpen] = useState<CreditBalance | null>(null);
  const [buying, setBuying] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);

  const balances = credits.state?.balances ?? [];
  const nowMs = credits.nowMs;
  // `held` is every peso the guest has here, expired included — the Top up sheet
  // states what the wallet holds, and quietly dropping dead money would make
  // the total disagree with the deck the guest is looking at. `onHold` is the
  // slice that is merely waiting, so an expired balance is not in it: it is not
  // going to become spendable.
  const held = balances.reduce((sum, b) => sum + b.balanceCents, 0);
  const onHold = balances.reduce(
    (sum, b) =>
      sum + (isLocked(b, nowMs) && !isExpired(b, nowMs) ? b.balanceCents : 0),
    0,
  );

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
            <BalanceStack balances={balances} nowMs={nowMs} onOpen={setOpen} />
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

      {/* The demo bar. A hold is measured in hours and an expiry in months, so
          without a way to move the clock neither rule is visible — you would
          have to leave the tab open for the whole window to watch a balance
          unlock, and for a quarter to watch one die. Pushing time forward runs
          the same rules a real wait would. It drives the CREDITS half only;
          Payment methods is live and reads Stripe, not this clock. Its caption
          is now the only place the screen states that the balances are not
          real, so it does not get shortened away.

          ONE RUNG PER TERM, and +6h was not one. The rungs are the scales the
          product actually has: +1h walks the 3h default hold, +24h walks the
          72h ceiling, +30d walks the 90-day expiry — which at +24h a click was
          ninety clicks away, i.e. a rule the demo could not reach. The count is
          unchanged, so the row still fits beside the label at 390px. */}
      <div className="border-border shrink-0 border-t px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="type-meta text-muted-foreground font-semibold tracking-[0.12em] uppercase">
            Demo clock
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {CLOCK_RUNGS.map((rung) => (
              <button
                key={rung.label}
                type="button"
                onClick={() => credits.advance(rung.hours)}
                className="border-border bg-card hover:bg-muted/50 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border px-3 text-xs font-semibold tabular-nums transition"
              >
                {rung.label}
              </button>
            ))}
            <button
              type="button"
              onClick={credits.reset}
              aria-label="Reset the emulator"
              className="border-border bg-card hover:bg-muted/50 grid min-h-[44px] min-w-[44px] place-items-center rounded-full border transition"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="text-muted-foreground/80 type-label mt-2">
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
        onHoldCents={onHold}
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
