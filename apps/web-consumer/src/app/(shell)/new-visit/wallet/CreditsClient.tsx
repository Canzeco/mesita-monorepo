"use client";

import { useState } from "react";
import {
  ChevronRight,
  CreditCard,
  Gift,
  Plus,
  RotateCcw,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { TicketHero } from "@/components/consumer/rewards/TicketHero";
import { BalanceStack } from "@/components/consumer/credits/BalanceStack";
import { BalanceDetail } from "@/components/consumer/credits/BalanceDetail";
import { BuyCreditsSheet } from "@/components/consumer/credits/BuyCreditsSheet";
import { CardsModal } from "@/components/consumer/me/CardsModal";
import { formatCurrency } from "@/lib/api/profile";
import type { CreditBalance } from "@/lib/mock/credits-mock";
import type { Seed } from "@/lib/mock/credits-emulator";
import { errorMessage, useCredits } from "@/lib/mock/use-credits";
import { cn } from "@/lib/utils";

// Wallet — the Activity tab's first section (MESITA-1381), at the unchanged
// route /inbox/credits.
//
// THE SECTION IS A CONTAINER, NOT A CURRENCY (Pato, 2026-08-31). It was called
// Credits while per-place prepaid balances were the only thing on it. It now
// holds three things — the Credits stack, the saved payment methods that were
// buried in Me › More › Cards, and gifting — so naming it after one of them
// was the mistake a container name exists to prevent. Credits stays the word
// for the MONEY: 🪙 Credits §D is untouched, `places.credits_enabled` and
// `visits_config.payCredits` are untouched, and when the universal Mesita
// Credits balance ships (MESITA-1380) it lands in the stack below as a card
// that can now be called Credits without colliding with its own container.
//
// MIXED LIVENESS, and the page says which is which. The Credits half is PARKED
// on a browser emulator — no table, no Edge Function, no venue side — and says
// so in three places (the Soon pill on the hero, the Soon chip on Gift, the
// demo bar). Payment methods is the one LIVE thing here: it opens the real
// Stripe-backed CardsModal, unchanged, so the card rail keeps working exactly
// as it did from Me. Never let the parked framing bleed onto that row.
//
// NO IN-BODY TITLE. Every section opens straight into its content; the pill
// row directly above already says Wallet.
//
// THE PAGE SCROLLS NOW, reversing the note that used to live here. That rule
// was written when the stack was the only content and a scroller around
// overlapping cards would have fought the thumb. It does not fight anything:
// BalanceStack is TAP ONLY by construction (it documents its own refusal to
// add pointer handlers), so there is no drag to lose to the scroller, and the
// stack sizes itself with an explicit height instead of filling a flex-1.
// Three sections cannot fit a phone without scrolling, so the constraint that
// actually binds changed.

/** One row in the wallet's non-Credits half. */
type WalletRow = {
  key: string;
  Icon: LucideIcon;
  title: string;
  summary: string;
  /** Parked: no table, EF or type yet. Visible, inert, honest. */
  soon?: boolean;
  onClick?: () => void;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="type-eyebrow text-muted-foreground px-5 pt-5 pb-2">
      {children}
    </div>
  );
}

export function CreditsClient({ seed }: { seed: Seed }) {
  const credits = useCredits(seed);
  const [open, setOpen] = useState<CreditBalance | null>(null);
  const [buying, setBuying] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);

  const balances = credits.state?.balances ?? [];
  const nowMs = credits.nowMs;

  // THE HERO IS A TOTAL HELD, NOT AN AMOUNT AVAILABLE. It used to read
  // "Available now" over the sum of the unlocked balances, and that number is
  // spendable nowhere: these balances are venue-locked and do not pool, so no
  // sum of them can be spent anywhere at all. Summing implies fungibility and
  // fungibility implies one currency — the exact promise 🪙 Credits §A makes
  // for MESITA-ISSUED Credits and that these venue-issued instruments do not
  // keep. So the label states what the number is, and the subline says where
  // it can actually go. Per-card unlock chips already carry maturation, twice,
  // so the hero does not repeat it.
  const held = balances.reduce((sum, b) => sum + b.balanceCents, 0);

  // The open sheet reads from live state, not the snapshot it was opened with,
  // so a spend updates the sheet it was made from instead of going stale.
  const openBalance = open
    ? (balances.find((b) => b.id === open.id) ?? null)
    : null;

  const rows: WalletRow[] = [
    {
      key: "cards",
      Icon: CreditCard,
      title: "Payment methods",
      summary: "Saved cards for Premium and Mesita Pay",
      onClick: () => setCardsOpen(true),
    },
    {
      key: "gift",
      Icon: Gift,
      title: "Gift Credits",
      summary: "Send Credits to a friend — they open Mesita already loaded",
      soon: true,
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="flex shrink-0 justify-end px-5 pt-4 pb-2">
          <button
            type="button"
            onClick={() => setBuying(true)}
            aria-label="Add Credits"
            className="border-border bg-card hover:bg-muted/50 grid size-9 shrink-0 place-items-center rounded-full border transition"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        {credits.loading ? (
          <div className="flex flex-col gap-3 px-5">
            <Skeleton className="h-24 w-full rounded-panel" />
            <Skeleton className="h-11 w-full rounded-2xl" />
            <Skeleton className="h-11 w-full rounded-2xl" />
          </div>
        ) : balances.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No Credits yet"
            description="Pay a place ahead of time and it gives you back more than you paid. Spend it there whenever you go."
            action={{ label: "Add Credits", onClick: () => setBuying(true) }}
          />
        ) : (
          <>
            {/* The one saturated surface on the screen, and it is the aggregate
                rather than a card — the passport-and-list shape from Me. */}
            <TicketHero className="bg-pink-gradient mx-5 shrink-0 px-5 py-4">
              <div className="flex items-center gap-2">
                <span className="type-meta font-semibold tracking-[0.12em] text-white/75 uppercase">
                  Total held
                </span>
                {/* The parked signal rides the hero. It is the loudest element
                    here, so it is the one place a guest cannot skim past — and
                    it must not be read as covering the live Payment methods
                    row further down. */}
                <span className="type-meta rounded-full border border-white/40 px-1.5 py-0.5 font-semibold tracking-[0.12em] text-white/90 uppercase">
                  Soon
                </span>
              </div>
              <div className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums">
                {formatCurrency(held)}
              </div>
              <div className="mt-0.5 text-xs text-white/75">
                {`Across ${balances.length} ${balances.length === 1 ? "place" : "places"} · spendable only where you paid`}
              </div>
            </TicketHero>

            <SectionLabel>Credits</SectionLabel>
            <div className="px-5">
              <BalanceStack
                balances={balances}
                nowMs={nowMs}
                onOpen={setOpen}
              />
            </div>
          </>
        )}

        <SectionLabel>In your wallet</SectionLabel>
        <div className="flex flex-col gap-2.5 px-5 pb-5">
          {rows.map((row) => {
            const inert = row.soon || !row.onClick;
            return (
              <button
                key={row.key}
                type="button"
                onClick={inert || !row.onClick ? undefined : row.onClick}
                disabled={inert}
                aria-disabled={inert}
                title={row.soon ? "Coming soon" : undefined}
                className={cn(
                  "border-border bg-card flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition active:scale-[0.99]",
                  inert ? "opacity-60" : "hover:bg-muted/50",
                )}
              >
                <span className="bg-muted text-foreground/70 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
                  <row.Icon className="h-[22px] w-[22px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-sm font-bold tracking-tight">
                      {row.title}
                    </span>
                    {row.soon && (
                      <span className="border-border text-muted-foreground type-meta rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase">
                        Soon
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {row.summary}
                  </span>
                </span>
                {!row.soon && (
                  <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
                )}
              </button>
            );
          })}
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

      {/* The demo bar. A lock is measured in hours and days, so without a way
          to move the clock the maturation rule is invisible — you would have to
          leave the tab open overnight to watch a balance unlock. Pushing time
          forward runs the same rule a real wait would. It drives the CREDITS
          half only; Payment methods is live and reads Stripe, not this clock. */}
      <div className="border-border shrink-0 border-t px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="type-meta text-muted-foreground font-semibold tracking-[0.12em] uppercase">
            Demo clock
          </span>
          <div className="ml-auto flex items-center gap-1.5">
            {[1, 6, 24].map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => credits.advance(h)}
                className="border-border bg-card hover:bg-muted/50 rounded-full border px-2.5 py-1 text-xs font-semibold tabular-nums transition"
              >
                +{h}h
              </button>
            ))}
            <button
              type="button"
              onClick={credits.reset}
              aria-label="Reset the emulator"
              className="border-border bg-card hover:bg-muted/50 grid size-7 place-items-center rounded-full border transition"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="text-muted-foreground/80 type-label mt-2">
          Emulated — example Credits in this browser only. Prepaid Credits
          aren&rsquo;t live yet. Your saved cards are real.
        </p>
      </div>

      <BuyCreditsSheet
        open={buying}
        onClose={() => setBuying(false)}
        onBuy={credits.buy}
        busy={credits.busy}
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
