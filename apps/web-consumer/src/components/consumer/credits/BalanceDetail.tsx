"use client";

import { LocalSheet } from "@/components/consumer/overlay/LocalOverlay";
import { SHEET_BODY_CLASS, SHEET_TITLE_CLASS } from "@/lib/ui-classes";
import { formatCurrency } from "@/lib/api/profile";
import {
  formatUnlock,
  isLocked,
  type CreditBalance,
} from "@/lib/mock/credits-mock";

// One balance, opened.
//
// A LocalSheet opened from page state, NOT an @modal intercept — so there is no
// route to add and nothing to register in isModalContractPath, whose only
// consumers are the two route-modal shells. An intercept missing from that
// predicate renders blank with typecheck, build and tests all green, and this
// surface has no reason to go near it.
//
// It carries the full name (the card strip truncates), the terms, and the
// activity list. That is deliberate: the panel is a fixed 80% of the card, and
// short content in it is a named regression — a confirm is a LocalDialog, not a
// short sheet.

export function BalanceDetail({
  balance,
  onClose,
}: {
  balance: CreditBalance | null;
  onClose: () => void;
}) {
  const locked = balance ? isLocked(balance) : false;
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
                    ? `Unlocks in ${formatUnlock(balance.maturesInHours!)}`
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
                          {a.when}
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
                Example balance. Prepaid Credits are not live yet — nothing here
                is money, and the terms above are not final.
              </p>
            </div>
          </div>
        </>
      )}
    </LocalSheet>
  );
}
