"use client";

import { useEffect } from "react";
import { Wallet } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import {
  WalletParkedNote,
  WalletScreen,
} from "@/components/consumer/wallet/WalletScreen";
import { formatCurrency } from "@/lib/api/profile";
import type { CreditLot, CreditPlaceBalance } from "@/lib/api/credits";
import {
  balanceState,
  formatActivation,
  formatExpiry,
  formatWhen,
  headlineCents,
  spendableAtCopy,
} from "@/lib/credits";
import { useCreditBalances } from "@/lib/use-credit-balances";
import { CONSUMER_ROUTES } from "@/lib/consumer-route-contract";

// One place's Credits, opened (MESITA-1674: real balances now).
//
// THE ID IN THE URL IS A PLACE ID, not a per-lot id — a balance IS a place's
// aggregate (credit_lots is place-scoped since MESITA-1892; it was org-scoped
// from MESITA-1671), the same unit the list screen renders one card per.
// `walletBalancePath` has never changed; what it addresses has, twice. The
// title is simply the place now: MESITA-1816's rule that a one-place
// organization borrows its place's name outlived the organization, and with
// nothing left to choose between there is no `balanceFace` to ask.
//
// IT IS ALSO THE ONLY TERM LEFT THAT CAN CLOSE THE SPEND CONTROLS — this line
// survives from the pre-1674 file almost verbatim, and the state it describes
// grew a middle: a balance used to open Available or Expired, because the buy
// path never applies the hold it still carries in the schema. This read
// surfaces PENDING lots (any other writer of credit_lots can still produce
// one), so a balance can now open on its way to spendable too.
//
// NO SPEND HERE. The old emulator let a guest draw a balance down from this
// screen. The real engine exists now (MESITA-1678 shipped
// apply_ticket_credits), but spending happens on THE TICKET's Pay step, and
// that row is still parked until MESITA-2052 un-parks it. Until then the
// parked note sits directly under the summary (MESITA-2051): "you cannot
// spend this yet" is the most useful fact on the page, and it used to be the
// last line, under the purchase history. The activity list below is real:
// every row is a credit_ledger entry, read straight off the lot.

function LotRow({ lot }: { lot: CreditLot }) {
  const state = lot.expired ? "expired" : lot.pending ? "pending" : "active";
  return (
    <li className="border-border flex items-center justify-between gap-3 border-b pb-2 last:border-b-0">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {state === "pending"
            ? `Activates ${formatWhen(Date.parse(lot.activatesAt))}`
            : "Bought Credits"}
        </span>
        <span className="text-muted-foreground text-xs">
          {formatWhen(Date.parse(lot.createdAt))}
          {state === "expired" ? " · expired" : ""}
        </span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">
        {formatCurrency(lot.remainingCents)}
      </span>
    </li>
  );
}

function BalanceBody({ balance, nowMs }: { balance: CreditPlaceBalance; nowMs: number }) {
  const state = balanceState(balance);
  const headline = headlineCents(balance);
  const daysLeft = balance.nearestExpiryAt
    ? (Date.parse(balance.nearestExpiryAt) - nowMs) / 86_400_000
    : null;
  const hoursLeft = balance.nearestActivationAt
    ? (Date.parse(balance.nearestActivationAt) - nowMs) / 3_600_000
    : null;
  const bonusCents = Math.max(
    0,
    balance.spendableCents + balance.pendingCents - balance.paidCents,
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="border-border bg-card rounded-2xl border p-4">
        <div className="type-eyebrow text-muted-foreground">
          {state === "expired" ? "Expired" : state === "pending" ? "Pending" : "Available"}
        </div>
        <div className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
          {formatCurrency(headline)}
        </div>
        <div className="text-muted-foreground mt-1 text-xs">
          {state === "expired"
            ? "These Credits can no longer be spent"
            : state === "pending" && hoursLeft !== null
              ? `Activates in ${formatActivation(hoursLeft)}`
              : spendableAtCopy(balance)}
        </div>
      </div>

      {state !== "expired" && (
        <WalletParkedNote>
          Paying at the table with Credits is coming soon — this balance is
          real, but spending it here isn&rsquo;t wired up yet.
        </WalletParkedNote>
      )}

      {state !== "expired" && (
        <dl className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground text-xs">You paid</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {formatCurrency(balance.paidCents)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground text-xs">Bonus</dt>
            <dd className="text-sm font-semibold tabular-nums">
              +{formatCurrency(bonusCents)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-muted-foreground text-xs">Spendable at</dt>
            <dd className="text-sm font-semibold">{balance.placeName}</dd>
          </div>
          {daysLeft !== null && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted-foreground text-xs">Expires</dt>
              <dd className="text-sm font-semibold tabular-nums">
                {formatWhen(Date.parse(balance.nearestExpiryAt as string))} (
                {formatExpiry(daysLeft)})
              </dd>
            </div>
          )}
        </dl>
      )}

      <div>
        <div className="type-eyebrow text-muted-foreground mb-2">Purchases</div>
        <ul className="flex flex-col gap-2">
          {balance.lots.map((lot) => (
            <LotRow key={lot.lotId} lot={lot} />
          ))}
        </ul>
      </div>
    </div>
  );
}

export function BalanceClient({ placeId }: { placeId: string }) {
  const credits = useCreditBalances();
  const balance = credits.balances.find((b) => b.placeId === placeId) ?? null;

  // The requested place may sit past the first page (a deep link, a reload
  // with more than DEFAULT_PAGE_SIZE balances already bought). Page through
  // automatically until it turns up or the list runs out, rather than making
  // the guest scroll the list first to "warm" this screen.
  useEffect(() => {
    if (!credits.loading && !balance && credits.hasMore && !credits.loadingMore) {
      void credits.loadMore();
    }
  }, [credits, balance]);

  const stillSearching = !balance && (credits.loading || credits.hasMore || credits.loadingMore);
  const title = balance ? balance.placeName : "Balance";

  return (
    <WalletScreen title={title}>
      {stillSearching ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      ) : balance ? (
        <>
          {/* 0, not Date.now() — see CreditsClient.tsx's identical note; this
              branch only renders once `balance` resolves, by which point
              useCreditBalances has already set a real nowMs alongside it. */}
          <BalanceBody balance={balance} nowMs={credits.nowMs ?? 0} />
          {credits.error && (
            <p role="alert" className="text-destructive mt-3 text-center text-xs">
              {credits.error}
            </p>
          )}
        </>
      ) : (
        // Ran out of pages without finding it: a bookmark to a balance that
        // no longer exists, or a hand-typed URL.
        <EmptyState
          icon={Wallet}
          title="That balance isn't here"
          description="Your other balances are still in the wallet."
          action={{
            label: "Back to Wallet",
            href: CONSUMER_ROUTES.wallet.root,
          }}
        />
      )}
    </WalletScreen>
  );
}
