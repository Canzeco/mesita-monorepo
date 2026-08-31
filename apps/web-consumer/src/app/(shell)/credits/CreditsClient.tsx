"use client";

import { useState } from "react";
import { Landmark } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { TicketHero } from "@/components/consumer/rewards/TicketHero";
import { BalanceStack } from "@/components/consumer/credits/BalanceStack";
import { BalanceDetail } from "@/components/consumer/credits/BalanceDetail";
import { formatCurrency } from "@/lib/api/profile";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import {
  isLocked,
  mockBalances,
  formatUnlock,
  spendableCents,
  type CreditBalance,
} from "@/lib/mock/credits-mock";
import type { CreditsDemoVariant } from "@/lib/credits-demo";

// Credits — the per-place prepaid balances (MESITA-1380).
//
// PARKED SURFACE, mock data, no engine on either side. It is reachable so the
// shape can be judged, and it says so on the page in two places: the Soon pill
// in the header and the marker under the stack. A source comment would have
// been invisible on the Vercel preview, which is where this actually gets
// looked at — CardsModal already set the precedent with its "Test mode" line.
//
// The page does NOT scroll. The stack is absolutely positioned inside a
// flex-1, and a scroller wrapped around overlapping cards is how you get a
// surface that fights the thumb.

export function CreditsClient({ variant }: { variant: CreditsDemoVariant }) {
  const balances = mockBalances(variant);
  const [open, setOpen] = useState<CreditBalance | null>(null);

  const spendable = balances.reduce((sum, b) => sum + spendableCents(b), 0);
  const maturing = balances
    .filter(isLocked)
    .reduce((sum, b) => sum + b.balanceCents, 0);
  const soonest = balances
    .filter(isLocked)
    .reduce<number | null>(
      (min, b) =>
        min == null || b.maturesInHours! < min ? b.maturesInHours! : min,
      null,
    );

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 px-5 pt-5 pb-3">
        <h1 className="text-2xl font-bold tracking-tight">Credits</h1>
        <span className="border-border text-muted-foreground type-meta rounded-full border px-1.5 py-0.5 font-semibold tracking-[0.12em] uppercase">
          Soon
        </span>
      </header>

      {balances.length === 0 ? (
        <EmptyState
          icon={Landmark}
          title="No balances yet"
          description="Pay a place ahead of time and it gives you more Credits than you paid. Spend them there whenever you go."
          action={{ label: "Find a place", href: CONSUMER_ROUTES.newVisit.root }}
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
            <BalanceStack balances={balances} onOpen={setOpen} />
          </div>

          <p className="text-muted-foreground/80 type-label shrink-0 px-5 pb-4 text-center">
            Preview — example balances. Prepaid Credits aren&rsquo;t live yet.
          </p>
        </>
      )}

      <BalanceDetail balance={open} onClose={() => setOpen(null)} />
    </div>
  );
}
