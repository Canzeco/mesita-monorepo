"use client";

import { useState } from "react";
import { ChevronRight, CreditCard, Gift, Plus, RotateCcw, Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { BalanceStack } from "@/components/consumer/credits/BalanceStack";
import { BalanceDetail } from "@/components/consumer/credits/BalanceDetail";
import { BuyCreditsSheet } from "@/components/consumer/credits/BuyCreditsSheet";
import { CardsModal } from "@/components/consumer/me/CardsModal";
import { formatCurrency } from "@/lib/api/profile";
import { isLocked, type CreditBalance } from "@/lib/mock/credits-mock";
import type { Seed } from "@/lib/mock/credits-emulator";
import { errorMessage, useCredits } from "@/lib/mock/use-credits";
import { cn } from "@/lib/utils";

// Wallet — the Pay tab's second section, at /new-visit/wallet.
//
// THE SECTION IS A CONTAINER, NOT A CURRENCY (Pato, 2026-08-31). It was called
// Credits while per-place prepaid balances were the only thing on it. It now
// holds the Credits stack, the saved payment methods that were buried in
// Me › More › Cards, and gifting — so naming it after one of them was the
// mistake a container name exists to prevent. Credits stays the word for the
// MONEY: 🪙 Credits §D is untouched, `places.credits_enabled` and
// `visits_config.payCredits` are untouched.
//
// THE CARDS LEAD (Pato, 2026-09-01). A pink "Total held" hero used to sit
// above them, and it was the loudest element on a screen whose subject was
// underneath it. Worse, the number itself is unspendable: these balances are
// venue-locked and do not pool, so no sum of them can be spent anywhere at all
// — the comment that used to live here spent twenty lines saying so while the
// hero went on shouting it. The total is now one quiet line that answers "how
// much do I have on Mesita" without pretending to be money you can move, and
// the saturation it was carrying moved onto the card faces, where the photo
// scrim earns it. One saturated surface per screen, still.
//
// TWO LABELLED ACTIONS, NOT AN ICON IN A CORNER. Top up used to be a bare `＋`
// in the top-right, which is the discoverability failure the whole app avoids
// elsewhere; Gift used to be a row in an "In your wallet" list nobody reads as
// a control. They are now a labelled pair under the cards: you open a wallet to
// see what you have, and buying more is what you do next.
//
// MIXED LIVENESS, and the page says which is which. The Credits BALANCES are
// PARKED on a browser emulator — no table, no Edge Function, no venue side.
// The TERMS are real: the hold and the bonus come from the console's Controls
// page through consumer-web-get-controls-config. Payment methods is fully live
// and opens the real Stripe-backed CardsModal. Never let the parked framing
// bleed onto that row.
//
// NO IN-BODY TITLE. Every section opens straight into its content; the pill
// row directly above already says Wallet.

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="type-eyebrow text-muted-foreground px-5 pt-4 pb-2">
      {children}
    </div>
  );
}

/** One of the two labelled actions under the cards. */
function ActionTile({
  Icon,
  title,
  summary,
  soon = false,
  onClick,
}: {
  Icon: typeof Gift;
  title: string;
  summary: string;
  /** Parked: no table, EF or type yet. Visible, inert, honest. */
  soon?: boolean;
  onClick?: () => void;
}) {
  const inert = soon || !onClick;
  return (
    <button
      type="button"
      onClick={inert ? undefined : onClick}
      disabled={inert}
      aria-disabled={inert}
      title={soon ? "Coming soon" : undefined}
      className={cn(
        "border-border bg-card flex flex-1 items-center gap-3 rounded-2xl border p-3.5 text-left transition active:scale-[0.99]",
        inert ? "opacity-60" : "hover:bg-muted/50",
      )}
    >
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-xl",
          soon ? "bg-muted text-foreground/70" : "bg-primary/10 text-primary",
        )}
      >
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-sm font-bold tracking-tight">{title}</span>
          {soon && (
            <span className="border-border text-muted-foreground type-meta rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase">
              Soon
            </span>
          )}
        </span>
        <span className="text-muted-foreground block truncate text-xs">
          {summary}
        </span>
      </span>
    </button>
  );
}

export function CreditsClient({ seed }: { seed: Seed }) {
  const credits = useCredits(seed);
  const [open, setOpen] = useState<CreditBalance | null>(null);
  const [buying, setBuying] = useState(false);
  const [cardsOpen, setCardsOpen] = useState(false);

  const balances = credits.state?.balances ?? [];
  const nowMs = credits.nowMs;
  const held = balances.reduce((sum, b) => sum + b.balanceCents, 0);
  const onHold = balances.reduce(
    (sum, b) => sum + (isLocked(b, nowMs) ? b.balanceCents : 0),
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
          <div className="flex flex-col gap-3 px-5 pt-5">
            <Skeleton className="h-4 w-2/3 rounded-full" />
            <Skeleton className="h-44 w-full rounded-2xl" />
            <Skeleton className="h-14 w-full rounded-2xl" />
          </div>
        ) : balances.length === 0 ? (
          // No `action`. EmptyState normally carries one, and the rule behind
          // that is real — a zero state without a next step is a dead end. It
          // already has one here: the labelled Top up tile renders directly
          // below, on every state of this screen. Passing the action too put
          // two "Top up" buttons 60px apart, which is the same control asking
          // to be pressed twice.
          <EmptyState
            icon={Wallet}
            title="No Credits yet"
            description="Pay a place ahead of time and it gives you back more than you paid. Spend it there whenever you go."
          />
        ) : (
          <>
            {/* The total, stated rather than shouted. It answers "how much do
                I have on Mesita" and stops there — it is a sum of venue-locked
                balances, so it is a count, never a spendable amount.

                AND IT NAMES THE HELD PART. "Spendable only where you paid" was
                the only qualifier, which reads as "all of it, at those places"
                — while a balance still inside its hold is spendable NOWHERE,
                and the seeded wallet opens with most of its money in that
                state. The clause appears only when there is something to
                declare, so a fully matured wallet keeps the shorter line. */}
            <p className="text-muted-foreground px-5 pt-4 pb-1 text-xs leading-relaxed">
              <span className="text-foreground text-sm font-bold tabular-nums">
                {formatCurrency(held)}
              </span>{" "}
              across {balances.length}{" "}
              {balances.length === 1 ? "place" : "places"}
              {onHold > 0 && <> · {formatCurrency(onHold)} still on hold</>} ·
              spendable only where you paid
              <span className="border-border text-muted-foreground type-meta ml-1.5 rounded-full border px-1.5 py-0.5 align-[1px] font-semibold tracking-[0.12em] uppercase">
                Soon
              </span>
            </p>

            <div className="px-5 pt-3">
              <BalanceStack
                balances={balances}
                nowMs={nowMs}
                onOpen={setOpen}
              />
            </div>
          </>
        )}

        <div className="flex gap-2.5 px-5 pt-4">
          <ActionTile
            Icon={Plus}
            title="Top up"
            summary="Buy Credits for later"
            onClick={() => setBuying(true)}
          />
          <ActionTile
            Icon={Gift}
            title="Gift"
            summary="Send to a friend"
            soon
          />
        </div>

        <SectionLabel>Also in your wallet</SectionLabel>
        <div className="px-5 pb-5">
          <button
            type="button"
            onClick={() => setCardsOpen(true)}
            className="border-border bg-card hover:bg-muted/50 flex w-full items-center gap-3.5 rounded-2xl border p-4 text-left transition active:scale-[0.99]"
          >
            <span className="bg-muted text-foreground/70 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
              <CreditCard className="h-[22px] w-[22px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold tracking-tight">
                Payment methods
              </span>
              <span className="text-muted-foreground block truncate text-xs">
                Saved cards for Premium and Mesita Pay
              </span>
            </span>
            <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" />
          </button>
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

      {/* The demo bar. A hold is measured in hours, so without a way to move
          the clock the maturation rule is invisible — you would have to leave
          the tab open for the whole window to watch a balance unlock. Pushing
          time forward runs the same rule a real wait would. It drives the
          CREDITS half only; Payment methods is live and reads Stripe, not this
          clock. */}
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
          aren&rsquo;t live yet. Your saved cards, and the {credits.policy.defaultHoldHours}
          h hold set in the console, are real.
        </p>
      </div>

      <BuyCreditsSheet
        open={buying}
        onClose={() => setBuying(false)}
        onBuy={credits.buy}
        busy={credits.busy}
        policy={credits.policy}
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
