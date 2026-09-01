"use client";

import { useState } from "react";
import { Landmark, Plus, RotateCcw } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { TicketHero } from "@/components/consumer/rewards/TicketHero";
import { BalanceStack } from "@/components/consumer/credits/BalanceStack";
import { BalanceDetail } from "@/components/consumer/credits/BalanceDetail";
import { BuyCreditsSheet } from "@/components/consumer/credits/BuyCreditsSheet";
import { formatCurrency } from "@/lib/api/profile";
import {
  formatUnlock,
  hoursUntil,
  isLocked,
  spendableCents,
  type CreditBalance,
} from "@/lib/mock/credits-mock";
import type { Seed } from "@/lib/mock/credits-emulator";
import { errorMessage, useCredits } from "@/lib/mock/use-credits";

// Credits — the per-place prepaid balances (MESITA-1380).
//
// PARKED SURFACE running on an emulator, not a backend. There is no credits
// table and no Edge Function, and the venue side does not exist at all, so
// nothing here is sellable. It says so on the page in three places: the Soon
// pill in the header, the marker under the stack, and the demo bar. A source
// comment would be invisible on the preview, which is where this gets looked
// at — CardsModal set that precedent with its "Test mode" line.
//
// The page does NOT scroll. The stack is absolutely positioned inside a flex-1,
// and a scroller wrapped around overlapping cards is how you get a surface that
// fights the thumb.

export function CreditsClient({ seed }: { seed: Seed }) {
  const credits = useCredits(seed);
  const [open, setOpen] = useState<CreditBalance | null>(null);
  const [buying, setBuying] = useState(false);

  const balances = credits.state?.balances ?? [];
  const nowMs = credits.nowMs;

  const spendable = balances.reduce(
    (sum, b) => sum + spendableCents(b, nowMs),
    0,
  );
  const maturing = balances
    .filter((b) => isLocked(b, nowMs))
    .reduce((sum, b) => sum + b.balanceCents, 0);
  const soonest = balances
    .filter((b) => isLocked(b, nowMs))
    .reduce<number | null>((min, b) => {
      const h = hoursUntil(b, nowMs);
      return min == null || h < min ? h : min;
    }, null);

  // The open sheet reads from live state, not the snapshot it was opened with,
  // so a spend updates the sheet it was made from instead of going stale.
  const openBalance = open
    ? (balances.find((b) => b.id === open.id) ?? null)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
        <span className="border-border text-muted-foreground type-meta rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase">
          Soon
        </span>
        <button
          type="button"
          onClick={() => setBuying(true)}
          aria-label="Buy Credits"
          className="border-border bg-card hover:bg-muted/50 ml-auto grid size-9 shrink-0 place-items-center rounded-full border transition"
        >
          <Plus className="h-4 w-4" />
        </button>
      </header>

      {credits.loading ? (
        <div className="flex flex-col gap-3 px-5">
          <Skeleton className="h-24 w-full rounded-panel" />
          <Skeleton className="h-11 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full rounded-2xl" />
        </div>
      ) : balances.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No balances yet"
          description="Pay a place ahead of time and it gives you more Credits than you paid. Spend them there whenever you go."
          action={{ label: "Buy Credits", onClick: () => setBuying(true) }}
        />
      ) : (
        <>
          {/* The one saturated surface on the screen, and it is the aggregate
              rather than a card — the passport-and-list shape from Me. */}
          <TicketHero className="bg-pink-gradient mx-5 shrink-0 px-5 py-4">
            <div className="type-meta font-semibold tracking-[0.12em] text-white/75 uppercase">
              {spendable > 0 ? "Available now" : "Maturing"}
            </div>
            <div className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums">
              {formatCurrency(spendable > 0 ? spendable : maturing)}
            </div>
            <div className="mt-0.5 text-xs text-white/75">
              {spendable > 0
                ? `Across ${balances.length} ${balances.length === 1 ? "place" : "places"}`
                : soonest != null
                  ? `First unlocks in ${formatUnlock(soonest)}`
                  : "Nothing spendable yet"}
            </div>
          </TicketHero>

          <div className="min-h-0 flex-1 overflow-hidden px-5 pt-5">
            <BalanceStack
              balances={balances}
              nowMs={nowMs}
              onOpen={setOpen}
            />
          </div>
        </>
      )}

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
          forward runs the same rule a real wait would. */}
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
          Emulated — example balances in this browser only. Prepaid Credits
          aren&rsquo;t live yet.
        </p>
      </div>

      <BuyCreditsSheet
        open={buying}
        onClose={() => setBuying(false)}
        onBuy={credits.buy}
        busy={credits.busy}
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
