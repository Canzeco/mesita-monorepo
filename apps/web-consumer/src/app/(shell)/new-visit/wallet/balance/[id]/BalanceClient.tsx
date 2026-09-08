"use client";

import { useState } from "react";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import {
  WalletParkedNote,
  WalletScreen,
} from "@/components/consumer/wallet/WalletScreen";
import { formatCurrency } from "@/lib/api/profile";
import {
  formatExpiry,
  formatWhen,
  daysUntilExpiry,
  isExpired,
  type CreditBalance,
} from "@/lib/mock/credits-mock";
import type { Seed } from "@/lib/mock/credits-emulator";
import { errorMessage, useCredits } from "@/lib/mock/use-credits";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";
import { cn } from "@/lib/utils";

// One balance, opened.
//
// THE EXPIRY DATE IS ALWAYS HERE, even at 89 days out. The card only mentions
// it when it is near, because a list is a glance; this is where a guest comes to
// read the terms of one balance, and a term you have to ask for is a term that
// surprises someone later. It is a `dl` row like the bonus and the place, not a
// warning — until it has passed, when the state block says so.
//
// IT IS ALSO THE ONLY TERM LEFT THAT CAN CLOSE THE SPEND CONTROLS. A balance
// used to open as "Maturing", with the buttons disabled and the CTA counting
// down a hold; Credits are active the moment they are bought now (Pato,
// 2026-09-08), so the two states are Available and Expired.

const SPENDS = [10_000, 25_000, 50_000];

function BalanceBody({
  balance,
  nowMs,
  busy,
  onSpend,
}: {
  balance: CreditBalance;
  nowMs: number;
  busy: boolean;
  onSpend: (balanceId: string, amountCents: number) => Promise<boolean>;
}) {
  const [amount, setAmount] = useState<number>(SPENDS[0]);
  const expired = isExpired(balance, nowMs);
  const bonusCents = balance.balanceCents - balance.paidCents;

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-card rounded-2xl border p-4">
        <div className="type-eyebrow text-muted-foreground">
          {expired ? "Expired" : "Available"}
        </div>
        <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
          {formatCurrency(balance.balanceCents)}
        </div>
        <div className="text-muted-foreground mt-1 text-xs">
          {expired
            ? `Expired on ${formatWhen(balance.expiresAtMs)}`
            : "Spendable at this place"}
        </div>
      </div>

      <dl className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground text-xs">You paid</dt>
          <dd className="text-sm font-semibold tabular-nums">
            {formatCurrency(balance.paidCents)}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground text-xs">
            Bonus from this place
          </dt>
          <dd className="text-sm font-semibold tabular-nums">
            +{formatCurrency(bonusCents)} ({balance.bonusPct}%)
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground text-xs">Spendable at</dt>
          <dd className="text-sm font-semibold">{balance.placeName} only</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-muted-foreground text-xs">
            {expired ? "Expired" : "Expires"}
          </dt>
          <dd className="text-sm font-semibold tabular-nums">
            {formatWhen(balance.expiresAtMs)}
            {expired
              ? null
              : ` (${formatExpiry(daysUntilExpiry(balance, nowMs))})`}
          </dd>
        </div>
      </dl>

      {/* Spending is the half of the instrument a list cannot show: a balance
          you cannot draw down is a receipt, not money. */}
      <div>
        <div className="type-eyebrow text-muted-foreground mb-2">
          Pay a bill
        </div>
        <div className="mb-2 flex gap-2">
          {SPENDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setAmount(s)}
              aria-pressed={s === amount}
              disabled={expired}
              className={cn(
                "flex-1 rounded-2xl border py-2.5 text-sm font-bold tabular-nums transition",
                s === amount
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card hover:bg-muted/50",
                expired && "opacity-60",
              )}
            >
              {formatCurrency(s)}
            </button>
          ))}
        </div>
        <Button
          onClick={() => onSpend(balance.id, amount)}
          disabled={expired || busy || amount > balance.balanceCents}
          className="w-full"
        >
          {expired
            ? "Expired"
            : amount > balance.balanceCents
              ? "Not enough Credits"
              : busy
                ? "Working…"
                : `Spend ${formatCurrency(amount)}`}
        </Button>
      </div>

      <div>
        <div className="type-eyebrow text-muted-foreground mb-2">Activity</div>
        <ul className="flex flex-col gap-2">
          {balance.activity.map((a) => (
            <li
              key={a.id}
              className="border-border flex items-center justify-between gap-3 border-b pb-2 last:border-b-0"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {a.label}
                </span>
                <span className="text-muted-foreground text-xs">
                  {formatWhen(a.atMs)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {a.amountCents < 0 ? "−" : "+"}
                {formatCurrency(Math.abs(a.amountCents))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <WalletParkedNote>
        Emulated. Prepaid Credits are not live yet — nothing here is money, and
        the terms above are not final.
      </WalletParkedNote>
    </div>
  );
}

export function BalanceClient({
  balanceId,
  seed,
}: {
  balanceId: string;
  seed: Seed;
}) {
  const credits = useCredits(seed);
  const balance =
    credits.state?.balances.find((b) => b.id === balanceId) ?? null;

  // The title cannot be known until the balance loads, and a header that
  // changes its own words mid-load is worse than one that waits.
  const title = balance ? balance.placeName : "Balance";

  return (
    <WalletScreen title={title}>
      {credits.loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : balance ? (
        <>
          <BalanceBody
            balance={balance}
            nowMs={credits.nowMs}
            busy={credits.busy}
            onSpend={credits.spend}
          />
          {credits.error && (
            <p role="alert" className="text-destructive mt-3 text-center text-xs">
              {errorMessage(credits.error)}
            </p>
          )}
        </>
      ) : (
        // A dead id: a bookmark to a balance that was spent to nothing and
        // re-seeded, or a hand-typed URL. Say so and offer the way back rather
        // than rendering an empty statement.
        <EmptyState
          icon={Wallet}
          title="That balance isn't here"
          description="It may have been spent, or this wallet was reset. Your other balances are still in the wallet."
          action={{
            label: "Back to Wallet",
            href: CONSUMER_ROUTES.newVisit.wallet,
          }}
        />
      )}
    </WalletScreen>
  );
}
