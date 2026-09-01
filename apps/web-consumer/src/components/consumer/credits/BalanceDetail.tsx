"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { formatCurrency } from "@/lib/api/profile";
import {
  formatUnlock,
  formatWhen,
  hoursUntil,
  isLocked,
  type CreditBalance,
} from "@/lib/mock/credits-mock";
import { cn } from "@/lib/utils";

// One balance, opened.
//
// A LocalSheet opened from page state, NOT an @modal intercept — so there is no
// route to add and nothing to register in isModalContractPath, whose only
// consumers are the two route-modal shells. An intercept missing from that
// predicate renders blank with typecheck, build and tests all green, and this
// surface has no reason to go near it.

const SPENDS = [10_000, 25_000, 50_000];

export function BalanceDetail({
  balance,
  nowMs,
  busy,
  onSpend,
  onClose,
}: {
  balance: CreditBalance | null;
  nowMs: number;
  busy: boolean;
  onSpend: (balanceId: string, amountCents: number) => Promise<boolean>;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState<number>(SPENDS[0]);
  const locked = balance ? isLocked(balance, nowMs) : false;
  const bonusCents = balance ? balance.balanceCents - balance.paidCents : 0;

  return (
    <LocalSheet
      open={balance != null}
      onClose={onClose}
      ariaLabel={balance ? `Credits at ${balance.placeName}` : "Balance"}
    >
      {balance && (
        <>
          <div className={SHEET_TITLE_CLASS}>{balance.placeName}</div>
          <div className={SHEET_BODY_CLASS}>
            <div className="flex flex-col gap-5">
              <div className="border-border bg-card rounded-2xl border p-4">
                <div className="type-eyebrow text-muted-foreground">
                  {locked ? "Maturing" : "Available"}
                </div>
                <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
                  {formatCurrency(balance.balanceCents)}
                </div>
                <div className="text-muted-foreground mt-1 text-xs">
                  {locked
                    ? `Unlocks in ${formatUnlock(hoursUntil(balance, nowMs))}`
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
                  <dt className="text-muted-foreground text-xs">
                    Spendable at
                  </dt>
                  <dd className="text-sm font-semibold">
                    {balance.placeName} only
                  </dd>
                </div>
              </dl>

              {/* Spending is the half of the instrument the stack cannot show:
                  a balance you cannot draw down is a receipt, not money. */}
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
                      disabled={locked}
                      className={cn(
                        "flex-1 rounded-2xl border py-2.5 text-sm font-bold tabular-nums transition",
                        s === amount
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-muted/50",
                        locked && "opacity-60",
                      )}
                    >
                      {formatCurrency(s)}
                    </button>
                  ))}
                </div>
                <Button
                  onClick={() => onSpend(balance.id, amount)}
                  disabled={
                    locked || busy || amount > balance.balanceCents
                  }
                  className="w-full"
                >
                  {locked
                    ? `Locked for ${formatUnlock(hoursUntil(balance, nowMs))}`
                    : amount > balance.balanceCents
                      ? "Not enough Credits"
                      : busy
                        ? "Working…"
                        : `Spend ${formatCurrency(amount)}`}
                </Button>
              </div>

              <div>
                <div className="type-eyebrow text-muted-foreground mb-2">
                  Activity
                </div>
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

              <p className="text-muted-foreground text-xs">
                Emulated. Prepaid Credits are not live yet — nothing here is
                money, and the terms above are not final.
              </p>
            </div>
          </div>
        </>
      )}
    </LocalSheet>
  );
}
