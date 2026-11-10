"use client";

// /activity — THE BAR'S ACTIVITY TAB (Pato, 2026-11-09, MESITA-3631: "Home
// Search Pay Activity Me"): every money line of the guest's in one list,
// newest first. It was Me › Transactions, /me/transactions (MESITA-3465),
// which now 308s here. The lines are the Wallet's own entries (consumer-web-get-
// wallet), across every place: prepaid, bonus, cashback, paid, refund. Each
// row names the place, the kind and the date, and the signed amount. A Paid
// row opens its proof on Pay, as on the Wallet. A cashback from a bill the
// waiter confirmed as paid in cash reads "Cash · confirmed by staff"
// (MESITA-3554), so it is told apart from card cashback. This page never
// adds money up; it only lists and formats what the server sent.

import { Fragment, type ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { ReceiptText } from "lucide-react";

import { RowDivider } from "@/components/consumer/me/settings-rows";
import { Skeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { apiGetWallet, ENTRY_LABEL, entryDate, money, type Wallet, type WalletEntry } from "@/lib/api/wallet";
import { CONSUMER_ROUTES, payReceiptPath } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";

type Line = WalletEntry & { place: string; currency: string };

/** The row's kind label: a waiter-confirmed cash cashback names itself. */
function lineLabel(l: Line): string {
  if (l.kind === "cashback" && l.confirmed_by === "waiter") return "Cash · confirmed by staff";
  return ENTRY_LABEL[l.kind] ?? l.kind;
}

/** Every entry of every balance, newest first. */
function linesOf(w: Wallet): Line[] {
  return w.balances
    .flatMap((b) =>
      b.entries.map((e) => ({ ...e, place: b.place?.name ?? "A Mesita place", currency: b.currency })),
    )
    .sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function ActivityPage() {
  const getSupabase = useLazyBrowserSupabase();
  const [lines, setLines] = useState<Line[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    apiGetWallet(getSupabase())
      .then((w) => {
        if (!live) return;
        setLines(linesOf(w));
        setFailed(false);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  return (
    <ActivityFrame>
      {lines ? (
        lines.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No activity yet"
            description="Payments, credit and cashback at Mesita places show up here."
            action={{ label: "Find a place", href: CONSUMER_ROUTES.home }}
          />
        ) : (
          <ul className="border-border bg-card overflow-hidden rounded-2xl border" data-transactions>
            {lines.map((l, i) => {
              const row = (
                <>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{l.place}</span>
                    <span className="text-muted-foreground block text-xs">
                      {lineLabel(l)} · {entryDate(l.at)}
                      {l.pending ? " · pending" : ""}
                    </span>
                  </span>
                  <span
                    className={
                      "shrink-0 text-sm font-semibold tabular-nums " +
                      (l.amount_cents > 0 ? "text-green-700" : "text-foreground")
                    }
                  >
                    {l.amount_cents > 0 ? "+" : ""}
                    {money(l.amount_cents, l.currency)}
                  </span>
                </>
              );
              return (
                <Fragment key={`${l.at}-${l.kind}-${i}`}>
                  {i > 0 && <RowDivider />}
                  <li>
                    {l.kind === "spend" && l.payment_id ? (
                      <Link
                        href={payReceiptPath(l.payment_id)}
                        className="hover:bg-muted flex min-h-14 items-center gap-3 px-4 py-2.5 transition"
                      >
                        {row}
                      </Link>
                    ) : (
                      <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">{row}</div>
                    )}
                  </li>
                </Fragment>
              );
            })}
          </ul>
        )
      ) : failed ? (
        <EmptyState
          icon={ReceiptText}
          title="Couldn't load activity"
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: () => setNonce((n) => n + 1) }}
        />
      ) : (
        <RowsSkeleton />
      )}
    </ActivityFrame>
  );
}

/** The tab's frame: the white header bar Pay wears (MESITA-3534), then the
 *  page. The loading frame draws the same shape (MESITA-2701). */
export function ActivityFrame({ children }: { children: ReactNode }) {
  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8">
      <header className="border-border bg-card sticky top-0 z-10 -mx-4 flex min-h-[4.25rem] items-center border-b px-4 pt-5 pb-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Activity</h1>
      </header>
      <div className="mt-5">{children}</div>
    </div>
  );
}

/** The list's bones: three rows in the card they land in. */
export function RowsSkeleton() {
  return (
    <div className="border-border bg-card overflow-hidden rounded-2xl border" aria-busy>
      {[0, 1, 2].map((i) => (
        <Fragment key={i}>
          {i > 0 && <RowDivider />}
          <div className="flex min-h-14 items-center gap-3 px-4 py-2.5">
            <span className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-1.5 h-3 w-20" />
            </span>
            <Skeleton className="h-5 w-16" />
          </div>
        </Fragment>
      ))}
    </div>
  );
}
