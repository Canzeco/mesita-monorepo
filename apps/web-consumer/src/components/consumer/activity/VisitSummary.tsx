"use client";

// A FINISHED VISIT ON ONE PAGE, /activity/visit/<tabId> (MESITA-3770, Pato:
// "the live workflow visit tickets and the output ticket must be different
// … the output ticket should display in one page the output, not all the
// steps"). Opened from Activity › Visits for a bill that is paid, expired or
// cancelled; an open bill still opens the live pay screens (/pay/tab/<id>).
//
//   Taquería Orinoco
//   Tue, Nov 10 · 8:42 PM
//
//   $1,150.00                              the total, large
//   Paid                                   the state, coloured text
//
//   ┌ Bill                       $1,000.00 ┐  what it was
//   │ Tip                          $150.00 │
//   ├ Credits                      $300.00 ┤  how it was paid
//   │ Card                         $500.00 │
//   │ Cash                         $350.00 │
//   ├ Cashback                    +$10.00  ┤  what came back
//   │ Waiter                           Ana │
//   └ Ticket                        48213  ┘
//
// No green full-screen, no live clock, no steps: those are for the waiter at
// the table. The page reads consumer-web-get-tab once.

import { useEffect, useState } from "react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { Screen } from "@/components/consumer/nav/Screen";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { apiGetTab, type GuestTab } from "@/lib/api/tab";
import { money } from "@/lib/api/wallet";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";
import { UtensilsCrossed } from "lucide-react";

const STATE: Record<string, { label: string; cls: string }> = {
  paid: { label: "Paid", cls: "text-green-700" },
  expired: { label: "Expired · nothing was paid", cls: "text-muted-foreground" },
  cancelled: { label: "Cancelled · nothing was paid", cls: "text-muted-foreground" },
  waiting_bill: { label: "Open", cls: "text-foreground" },
  billed: { label: "Open", cls: "text-foreground" },
  paying: { label: "Paying", cls: "text-foreground" },
};

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function VisitSummary({ tabId }: { tabId: string }) {
  const getSupabase = useLazyBrowserSupabase();
  const [tab, setTab] = useState<GuestTab | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let gone = false;
    apiGetTab(getSupabase(), tabId)
      .then((r) => {
        if (!gone) setTab(r.tab);
      })
      .catch(() => {
        if (!gone) setFailed(true);
      });
    return () => {
      gone = true;
    };
  }, [getSupabase, tabId, attempt]);

  return (
    <Screen title="Visit">
      {tab ? (
        <Summary tab={tab} />
      ) : failed ? (
        <EmptyState
          icon={UtensilsCrossed}
          title="Couldn't load this visit"
          description="Check your connection and try again."
          action={{
            label: "Try again",
            onClick: () => {
              setFailed(false);
              setAttempt((n) => n + 1);
            },
          }}
        />
      ) : (
        <VisitSummarySkeleton />
      )}
    </Screen>
  );
}

function Summary({ tab }: { tab: GuestTab }) {
  const m = (c: number) => money(c, tab.currency);
  const paid = tab.status === "paid";
  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const card = tab.card_bill_cents + tab.card_tip_cents;
  const tip = tab.cash_tip_cents + tab.card_tip_cents;
  const total = paid ? tab.credit_cents + cash + card : (tab.bill_cents ?? 0);
  const at = tab.paid_at ?? tab.updated_at;
  const state = STATE[tab.status] ?? { label: tab.status, cls: "text-muted-foreground" };

  const what: Array<[string, string]> = paid
    ? [
        ["Bill", m(total - tip)],
        ["Tip", tip > 0 ? m(tip) : "No tip"],
      ]
    : tab.bill_cents != null
      ? [["Bill", m(tab.bill_cents)]]
      : [];
  const how: Array<[string, string]> = paid
    ? ([
        tab.credit_cents > 0 ? ["Credits", m(tab.credit_cents)] : null,
        card > 0 ? ["Card", m(card)] : null,
        cash > 0 ? ["Cash", m(cash)] : null,
      ].filter(Boolean) as Array<[string, string]>)
    : [];
  const more: Array<[string, string]> = [
    ...(paid && tab.cashback_cents > 0
      ? ([["Cashback", `+${m(tab.cashback_cents)}`]] as Array<[string, string]>)
      : []),
    ...(tab.waiter_name ? ([["Waiter", tab.waiter_name]] as Array<[string, string]>) : []),
    ...(tab.ticket ? ([["Ticket", tab.ticket]] as Array<[string, string]>) : []),
  ];

  return (
    <div className="flex flex-col gap-5" data-visit-summary>
      <header>
        <h1 className="text-lg font-semibold">{tab.place.name ?? "A Mesita place"}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">
          {day(at)} · {clockTime(at)}
        </p>
      </header>

      <div>
        <p
          className={cn(
            "font-display text-4xl font-semibold tracking-tight tabular-nums",
            !paid && "text-muted-foreground",
          )}
        >
          {tab.bill_cents == null && !paid ? "No bill" : m(total)}
        </p>
        <p className={cn("mt-1 text-sm font-semibold", state.cls)}>{state.label}</p>
      </div>

      {what.length + how.length + more.length > 0 ? (
        <dl className="bg-card border-border divide-border divide-y overflow-hidden rounded-2xl border">
          {[what, how, more]
            .filter((g) => g.length > 0)
            .map((group, gi) => (
              <div key={gi} className="px-4 py-1">
                {group.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 py-2.5">
                    <dt className="text-muted-foreground text-sm">{k}</dt>
                    <dd
                      className={cn(
                        "text-base font-medium tabular-nums",
                        k === "Cashback" && "text-green-700",
                      )}
                    >
                      {v}
                    </dd>
                  </div>
                ))}
              </div>
            ))}
        </dl>
      ) : null}
    </div>
  );
}

export function VisitSummarySkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy>
      <div>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-32" />
      </div>
      <div>
        <Skeleton className="h-10 w-40" />
        <Skeleton className="mt-2 h-4 w-16" />
      </div>
      <Skeleton className="h-56 w-full rounded-2xl" />
    </div>
  );
}
