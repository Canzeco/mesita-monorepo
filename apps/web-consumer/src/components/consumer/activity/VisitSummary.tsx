"use client";

// A VISIT'S FULL STATEMENT, /me/tickets/visit/<tabId> (MESITA-3770 made it one
// page apart from the live pay screens; MESITA-3780, Pato: "in visits mention
// the select pay methods and everything. be fucking detailed"). Opened from
// Me › Tickets › Visits for a bill that is paid, expired or cancelled; an open
// bill still opens /pay/tab/<id>. Every state draws the same sections, top
// to bottom:
//
//   Taquería Orinoco                      the place
//   Opened Wed, Nov 11 · 22:34            when
//   $230.00MX                             the total, large
//   Paid · 22:51                          the state, coloured
//
//   THE BILL          Bill · Tip (the waiter's suggestion when it differs) ·
//                     Total · who typed it
//   HOW YOU PAID      Credits · Card · Cash: each its amount, bill + tip, and
//   (HOW YOU CHOSE    its state (Paid · 22:51, Charging, Failed, Not charged,
//    TO PAY)          Received by the waiter); a paid part opens its receipt
//   CASHBACK          per method, its rate; granted, or what the waiter's
//                     signature would earn; credits and tips never earn
//   SPLIT             a share or a split table: the table's bill, ways, your
//                     share, paid, left
//   TIMELINE          opened, billed, each payment started / paid / failed,
//                     paid, signed, expired or cancelled
//   DETAILS           waiter, ticket, visit number, test mode
//   Open the place · Pay here again
//
// No green full screen, no live clock, no steps: those are for the waiter at
// the table. One read of consumer-web-get-tab; older reads without the part
// amounts fall back to the tab's own split.

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Banknote, ChevronRight, CreditCard, UtensilsCrossed, WalletCards } from "lucide-react";
import { clockTime } from "@mesita/place-profile/lib/money";
import { Screen } from "@/components/consumer/nav/Screen";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/shared/Skeleton";
import { apiGetTab, type GuestTab } from "@/lib/api/tab";
import { money } from "@/lib/api/wallet";
import { payPlacePath, payReceiptPath, placePath } from "@/lib/consumer-route-contract";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type Part = GuestTab["parts"][number];

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
const when = (iso: string) => `${day(iso)} · ${clockTime(iso)}`;
const pct = (bps: number) => `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;

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
        <Statement tab={tab} />
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

// ─── Pieces ─────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title}>
      <h2 className="text-muted-foreground type-eyebrow mb-2">{title}</h2>
      <div className="bg-card border-border divide-border divide-y overflow-hidden rounded-2xl border">
        {children}
      </div>
    </section>
  );
}

/** One line of a section: the label (and a quiet line under it) on the left,
 *  the value (and its state under it) on the right. With `href`, a link. */
function Line({
  label,
  sub,
  value,
  state,
  tone = "ink",
  icon,
  href,
  strong = false,
}: {
  label: string;
  sub?: string | null;
  value?: string | null;
  state?: string | null;
  tone?: "green" | "ink" | "grey" | "red";
  icon?: ReactNode;
  href?: string;
  strong?: boolean;
}) {
  const body = (
    <>
      {icon ? (
        <span className="bg-muted text-foreground flex h-9 w-9 shrink-0 items-center justify-center rounded-full" aria-hidden>
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm", strong ? "font-semibold" : "text-muted-foreground")}>{label}</span>
        {sub ? <span className="text-muted-foreground mt-0.5 block text-xs tabular-nums">{sub}</span> : null}
      </span>
      <span className="flex shrink-0 flex-col items-end text-right">
        {value ? (
          <span className={cn("text-base tabular-nums", strong ? "font-semibold" : "font-medium")}>{value}</span>
        ) : null}
        {state ? (
          <span
            className={cn(
              "mt-0.5 text-xs font-medium",
              tone === "green" && "text-green-700",
              tone === "grey" && "text-muted-foreground",
              tone === "red" && "text-destructive",
            )}
          >
            {state}
          </span>
        ) : null}
      </span>
      {href ? <ChevronRight className="text-muted-foreground/60 h-4 w-4 shrink-0" aria-hidden /> : null}
    </>
  );
  const cls = "flex items-center gap-3 px-4 py-3";
  return href ? (
    <PushLink href={href} className={cn(cls, "hover:bg-muted/40 transition")}>
      {body}
    </PushLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** A part's state in words, and its tone. */
function partState(p: Part | undefined, guestTab: boolean): [string, "green" | "ink" | "grey" | "red"] {
  if (!p) return ["Not charged", "grey"];
  switch (p.status) {
    case "paid":
      return [p.paid_at ? `Paid · ${clockTime(p.paid_at)}` : "Paid", "green"];
    case "partly_refunded":
      return ["Partly refunded", "ink"];
    case "refunded":
      return ["Refunded", "grey"];
    case "opening":
    case "open":
      return p.part === "card"
        ? ["Charging", "ink"]
        : [guestTab ? "Waiting for the waiter" : "Waiting for the cash", "ink"];
    case "failed":
      return ["Failed", "red"];
    case "expired":
      return ["Not charged", "grey"];
    default:
      return [p.status, "grey"];
  }
}

const PART_NAME: Record<string, string> = { card: "Card", outside: "Cash" };

// ─── The statement ──────────────────────────────────────────────────────────

function Statement({ tab }: { tab: GuestTab }) {
  const m = (c: number) => money(c, tab.currency);
  const paid = tab.status === "paid";
  const open = tab.status === "waiting_bill" || tab.status === "billed" || tab.status === "paying";
  const guestTab = tab.origin === "guest";
  const placeName = tab.place.name ?? "A Mesita place";

  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const card = tab.card_bill_cents + tab.card_tip_cents;
  const tip = tab.cash_tip_cents + tab.card_tip_cents;
  const chosen = tab.credit_cents + cash + card;
  const total = chosen > 0 ? chosen : (tab.bill_cents ?? 0);

  // The newest part of each kind decides its method's state.
  const latest = (kind: string) => tab.parts.filter((p) => p.part === kind).at(-1);
  const cardPart = latest("card");
  const cashPart = latest("outside");

  const state: [string, string] = paid
    ? guestTab && !tab.verified_at
      ? ["Paid · waiting for the waiter's signature", "text-foreground"]
      : [tab.paid_at ? `Paid · ${clockTime(tab.paid_at)}` : "Paid", "text-green-700"]
    : tab.status === "expired"
      ? ["Expired · nothing was paid", "text-muted-foreground"]
      : tab.status === "cancelled"
        ? ["Cancelled · nothing was paid", "text-muted-foreground"]
        : tab.status === "paying"
          ? ["Paying", "text-foreground"]
          : tab.status === "billed"
            ? ["Billed · not paid yet", "text-foreground"]
            : ["Waiting for the bill", "text-foreground"];

  // ── How it was (or would have been) paid ──
  const creditState: [string, "green" | "ink" | "grey"] = paid
    ? ["Used", "green"]
    : open
      ? ["Held for this bill", "ink"]
      : ["Not used", "grey"];
  const methods: ReactNode[] = [];
  if (tab.credit_cents > 0) {
    methods.push(
      <Line
        key="credit"
        icon={<WalletCards className="h-4 w-4" />}
        label="Credits"
        sub={`Your credit at ${placeName} · bill only`}
        value={m(tab.credit_cents)}
        state={creditState[0]}
        tone={creditState[1]}
        strong
      />,
    );
  }
  if (card > 0 || cardPart) {
    const [s, tone] = partState(cardPart, guestTab);
    methods.push(
      <Line
        key="card"
        icon={<CreditCard className="h-4 w-4" />}
        label="Card"
        sub={`${m(tab.card_bill_cents)} bill + ${m(tab.card_tip_cents)} tip`}
        value={m(card)}
        state={s}
        tone={tone}
        href={cardPart && cardPart.paid_at ? payReceiptPath(cardPart.id) : undefined}
        strong
      />,
    );
  }
  if (cash > 0 || cashPart) {
    let [s, tone] = partState(cashPart, guestTab);
    if (tab.cash_received_cents != null) {
      s = `Received by the waiter · ${m(tab.cash_received_cents)}`;
      tone = "green";
    } else if (!cashPart && !open) {
      s = "Not paid";
      tone = "grey";
    }
    methods.push(
      <Line
        key="cash"
        icon={<Banknote className="h-4 w-4" />}
        label="Cash"
        sub={`${m(tab.cash_bill_cents)} bill + ${m(tab.cash_tip_cents)} tip · given to the waiter`}
        value={m(cash)}
        state={s}
        tone={tone}
        href={cashPart && cashPart.paid_at ? payReceiptPath(cashPart.id) : undefined}
        strong
      />,
    );
  }

  // ── Cashback, per method ──
  const cardBps = cardPart?.cashback_bps ?? tab.rates.card_back_bps;
  const cashBps = cashPart?.cashback_bps ?? tab.rates.cash_back_bps;
  const cardBack = cardPart?.cashback_cents ?? 0;
  const cashBack = cashPart?.cashback_cents ?? 0;
  const onSign = tab.cashback_on_sign_cents ?? 0;
  const showCashback = tab.cashback_cents > 0 || onSign > 0 || (card > 0 && cardBps > 0) || (cash > 0 && cashBps > 0);

  // ── Timeline ──
  const events: Array<[string, string, string?]> = [];
  if (tab.created_at) events.push([tab.created_at, "Opened"]);
  if (tab.billed_at)
    events.push([
      tab.billed_at,
      guestTab ? "You typed the bill" : tab.waiter_name ? `Billed by ${tab.waiter_name}` : "Billed by the waiter",
      tab.bill_cents != null ? m(tab.bill_cents) : undefined,
    ]);
  if (tab.paying_at) events.push([tab.paying_at, "You chose how to pay", chosen > 0 ? m(chosen) : undefined]);
  for (const p of tab.parts) {
    const name = PART_NAME[p.part ?? ""] ?? "Payment";
    const amount = (p.card_cents ?? 0) + (p.cash_cents ?? 0) + (p.credit_cents ?? 0) + (p.tip_cents ?? 0);
    if (p.created_at) events.push([p.created_at, `${name} payment started`, amount > 0 ? m(amount) : undefined]);
    if (p.paid_at) events.push([p.paid_at, `${name} paid`]);
    else if (p.status === "failed" && p.created_at) events.push([p.created_at, `${name} payment failed`]);
  }
  if (tab.paid_at) events.push([tab.paid_at, "Paid", m(total)]);
  if (tab.verified_at) events.push([tab.verified_at, "Signed by the waiter"]);
  if (tab.status === "expired") events.push([tab.expires_at, "Expired"]);
  if (tab.status === "cancelled") events.push([tab.updated_at, "Cancelled"]);
  events.sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]));

  const suggested = tab.tip_suggested_cents;
  const opened = tab.created_at ?? tab.billed_at ?? tab.updated_at;

  return (
    <div className="flex flex-col gap-6 pb-4" data-visit-summary>
      <header>
        <h1 className="text-lg font-semibold">{placeName}</h1>
        <p className="text-muted-foreground mt-0.5 text-sm tabular-nums">Opened {when(opened)}</p>
        <p
          className={cn(
            "font-display mt-4 text-4xl font-semibold tracking-tight tabular-nums",
            !paid && "text-muted-foreground",
          )}
        >
          {tab.bill_cents == null && chosen === 0 ? "No bill" : m(total)}
        </p>
        <p className={cn("mt-1 text-sm font-semibold", state[1])}>{state[0]}</p>
      </header>

      {tab.bill_cents != null ? (
        <Section title="The bill">
          <Line label="Bill" value={m(tab.bill_cents)} />
          <Line
            label="Tip"
            sub={suggested > 0 && suggested !== tip ? `The waiter suggested ${m(suggested)}` : null}
            value={tip > 0 ? m(tip) : chosen > 0 ? "No tip" : suggested > 0 ? `${m(suggested)} suggested` : "—"}
          />
          <Line label="Total" value={m(tab.bill_cents + tip)} strong />
          <Line
            label="Typed by"
            value={guestTab ? "You" : tab.waiter_name ?? "The waiter"}
          />
        </Section>
      ) : null}

      <Section title={paid ? "How you paid" : "How you chose to pay"}>
        {methods.length > 0 ? (
          methods
        ) : (
          <Line label="No payment method was chosen" sub={open ? null : "Nothing was charged"} />
        )}
      </Section>

      {showCashback ? (
        <Section title="Cashback">
          {card > 0 ? (
            <Line
              label="On the card"
              sub={`${pct(cardBps)} of ${m(tab.card_bill_cents)} bill`}
              value={cardBack > 0 ? `+${m(cardBack)}` : null}
              state={cardBack > 0 ? "Granted" : paid ? "Not granted" : "Not earned"}
              tone={cardBack > 0 ? "green" : "grey"}
            />
          ) : null}
          {cash > 0 ? (
            <Line
              label="On the cash"
              sub={`${pct(cashBps)} of ${m(tab.cash_bill_cents)} bill`}
              value={cashBack > 0 ? `+${m(cashBack)}` : null}
              state={cashBack > 0 ? "Granted" : paid ? "Not granted" : "Not earned"}
              tone={cashBack > 0 ? "green" : "grey"}
            />
          ) : null}
          {onSign > 0 ? (
            <Line label="When the waiter signs" value={`+${m(onSign)}`} state="Pending" tone="ink" />
          ) : null}
          <Line
            label="Total cashback"
            sub="As credit at this place · credits and tips never earn"
            value={`+${m(tab.cashback_cents)}`}
            strong
          />
        </Section>
      ) : null}

      {tab.table ? (
        <Section title="Split with friends">
          <Line label="Table bill" value={m(tab.table.bill_cents)} />
          <Line label="Split" value={tab.table.ways ? `${tab.table.ways} ways` : `${tab.table.shares.length} shares`} />
          {tab.bill_cents != null ? <Line label="Your share" value={m(tab.bill_cents)} strong /> : null}
          <Line label="Paid at the table" value={m(tab.table.paid_cents)} />
          <Line label="Left" value={m(tab.table.left_cents)} />
        </Section>
      ) : null}

      {events.length > 0 ? (
        <Section title="Timeline">
          {events.map(([at, label, value], i) => (
            <Line key={`${at}-${label}-${i}`} label={label} sub={when(at)} value={value ?? null} />
          ))}
        </Section>
      ) : null}

      <Section title="Details">
        {tab.waiter_name ? <Line label="Waiter" value={tab.waiter_name} /> : null}
        {tab.ticket ? <Line label="Ticket" value={`#${tab.ticket}`} /> : null}
        <Line label="Visit number" value={tab.tab_id.slice(0, 8).toUpperCase()} />
        {tab.test_mode ? <Line label="Test payment" sub="No real money moved" /> : null}
      </Section>

      <div className="flex gap-2">
        <Link
          href={placePath(tab.place.id)}
          className="border-border bg-card hover:bg-muted/60 flex h-11 flex-1 items-center justify-center rounded-full border text-sm font-semibold transition"
        >
          Open the place
        </Link>
        <Link
          href={payPlacePath(tab.place.id)}
          className="border-border bg-card hover:bg-muted/60 flex h-11 flex-1 items-center justify-center rounded-full border text-sm font-semibold transition"
        >
          Pay here again
        </Link>
      </div>
    </div>
  );
}

export function VisitSummarySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy>
      <div>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-40" />
        <Skeleton className="mt-4 h-10 w-44" />
        <Skeleton className="mt-2 h-4 w-24" />
      </div>
      <Skeleton className="h-44 w-full rounded-2xl" />
      <Skeleton className="h-36 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );
}
