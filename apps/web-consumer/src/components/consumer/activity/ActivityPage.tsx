"use client";

// /activity — THE BAR'S ACTIVITY TAB (Pato, 2026-11-09, MESITA-3631: "Home
// Search Pay Activity Me"). It was Me › Transactions, /me/transactions
// (MESITA-3465), which now 308s here.
//
// A RAIL OF EVENT TYPES OVER ONE FEED (Pato, MESITA-3633: "Show horizontal
// catalog or something of types of events ... Reservations, x, y, z ... list
// almost everything"): under the title, a horizontal rail of chips, All
// first, then every kind of thing a guest does at Mesita that the app can
// read today. Every chip is always there; an empty one says so. The feed is
// newest first and is built only from what the server sends:
//
//   Reservations   consumer-web-list-reservations (when it was made, its
//                  state, the time and the party)
//   Payments       a bill paid (spend), opening its receipt
//   Cashback       cashback in credit (a waiter-confirmed cash bill names
//                  itself, MESITA-3554)
//   Credits        credits bought (prepay)
//   Vouchers       a voucher's credit
//   Bonus          bonus credit
//   Stories        a Story voucher waiting for its post (MESITA-3507)
//   Gifts          credit sent to or taken from a friend, and links not
//                  taken yet (MESITA-3292)
//   Refunds        a reversal
//
// The money lines are the Wallet's own entries (consumer-web-get-wallet).
// This page never adds money up; it only lists and formats what the server
// sent. Each source fails on its own: a failed one leaves the other's rows.

import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Ban,
  CalendarCheck,
  Camera,
  Coins,
  Gift,
  type LucideIcon,
  ReceiptText,
  Sparkles,
  Ticket,
  Undo2,
  Wallet as WalletIcon,
} from "lucide-react";

import { RowDivider } from "@/components/consumer/me/settings-rows";
import { Skeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import { apiListReservations, type EFReservationRow } from "@/lib/api/reservations";
import { apiGetWallet, ENTRY_LABEL, entryDate, money, type Wallet, type WalletEntry } from "@/lib/api/wallet";
import { CONSUMER_ROUTES, payReceiptPath, reservationPath, walletPlacePath } from "@/lib/consumer-route-contract";
import { stateMeta } from "@/lib/reservation-state";
import { toReservationItem } from "@/lib/reservations-adapter";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";

type TypeKey =
  | "reservations"
  | "payments"
  | "cashback"
  | "credits"
  | "vouchers"
  | "bonus"
  | "stories"
  | "gifts"
  | "refunds";

/** The rail, in order, after All. `empty` is the chip's empty line. */
const TYPES: readonly { key: TypeKey; label: string; Icon: LucideIcon; empty: string }[] = [
  { key: "reservations", label: "Reservations", Icon: CalendarCheck, empty: "Tables you book show up here." },
  { key: "payments", label: "Payments", Icon: ReceiptText, empty: "Bills you pay with Mesita show up here." },
  { key: "cashback", label: "Cashback", Icon: Coins, empty: "Cashback from your bills shows up here." },
  { key: "credits", label: "Credits", Icon: WalletIcon, empty: "Credits you buy at a place show up here." },
  { key: "vouchers", label: "Vouchers", Icon: Ticket, empty: "Vouchers you use show up here." },
  { key: "bonus", label: "Bonus", Icon: Sparkles, empty: "Bonus credit shows up here." },
  { key: "stories", label: "Stories", Icon: Camera, empty: "Story vouchers waiting for your post show up here." },
  { key: "gifts", label: "Gifts", Icon: Gift, empty: "Credit you send or get from a friend shows up here." },
  { key: "refunds", label: "Refunds", Icon: Undo2, empty: "Refunded payments show up here." },
];

const TYPE_OF: Record<string, TypeKey> = {
  spend: "payments",
  cashback: "cashback",
  prepay: "credits",
  voucher: "vouchers",
  bonus: "bonus",
  reversal: "refunds",
  gift_out: "gifts",
  gift_in: "gifts",
  gift_back: "gifts",
};

type Filter = "all" | TypeKey;

/** One row of the feed, whatever its source. */
type Ev = {
  key: string;
  type: TypeKey;
  /** ISO time it happened; null sorts last. */
  at: string | null;
  title: string;
  line: string;
  /** Signed cents, shown on the right. */
  amount?: { cents: number; currency: string };
  /** A row that went nowhere (a declined or cancelled booking) wears Ban. */
  off?: boolean;
  href?: string;
};

function entryLabel(e: WalletEntry): string {
  if (e.kind === "cashback" && e.confirmed_by === "waiter") return "Cash · confirmed by staff";
  return ENTRY_LABEL[e.kind] ?? e.kind;
}

function walletEvents(w: Wallet): Ev[] {
  const out: Ev[] = [];
  for (const b of w.balances) {
    const place = b.place?.name ?? "A Mesita place";
    b.entries.forEach((e, i) => {
      const type = TYPE_OF[e.kind];
      if (!type) return;
      out.push({
        key: `w-${b.place_id}-${e.at}-${e.kind}-${i}`,
        type,
        at: e.at,
        title: place,
        line: `${entryLabel(e)} · ${entryDate(e.at)}${e.pending ? " · pending" : ""}`,
        amount: { cents: e.amount_cents, currency: b.currency },
        href: e.kind === "spend" && e.payment_id ? payReceiptPath(e.payment_id) : walletPlacePath(b.place_id),
      });
    });
  }
  for (const s of w.waiting_stories ?? []) {
    out.push({
      key: `s-${s.purchase_id}`,
      type: "stories",
      at: s.paid_at,
      title: s.place?.name ?? "A Mesita place",
      line: `Story voucher · waiting for your post${s.paid_at ? ` · ${entryDate(s.paid_at)}` : ""}`,
      amount: { cents: s.credit_cents, currency: s.currency },
      href: walletPlacePath(s.place_id),
    });
  }
  const names = new Map(w.balances.map((b) => [b.place_id, b.place?.name ?? null]));
  for (const l of w.sent_links ?? []) {
    out.push({
      key: `g-${l.gift_id}`,
      type: "gifts",
      at: l.created_at,
      title: names.get(l.place_id) ?? "A Mesita place",
      line: `Link sent · not taken yet · ${entryDate(l.created_at)}`,
      amount: { cents: -l.amount_cents, currency: l.currency },
      href: walletPlacePath(l.place_id),
    });
  }
  return out;
}

function reservationEvents(rows: EFReservationRow[]): Ev[] {
  return rows.map((row) => {
    const item = toReservationItem(row);
    const label = stateMeta(item.state).label;
    return {
      key: `r-${row.id}`,
      type: "reservations",
      at: row.created_at,
      title: item.placeName,
      line: `${label} · ${item.when} · ${item.partySize} ${item.partySize === 1 ? "person" : "people"}`,
      off: item.state === "cancelled" || item.state === "failed",
      href: reservationPath(row.id),
    };
  });
}

/** How many reservations the feed reads (the newest). */
const RESERVATIONS_LIMIT = 100;

export function ActivityPage() {
  const getSupabase = useLazyBrowserSupabase();
  const [wallet, setWallet] = useState<Ev[] | null>(null);
  const [bookings, setBookings] = useState<Ev[] | null>(null);
  const [failed, setFailed] = useState({ wallet: false, bookings: false });
  const [nonce, setNonce] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");

  useEffect(() => {
    let live = true;
    const client = getSupabase();
    apiGetWallet(client)
      .then((w) => {
        if (!live) return;
        setWallet(walletEvents(w));
        setFailed((f) => ({ ...f, wallet: false }));
      })
      .catch(() => {
        if (live) setFailed((f) => ({ ...f, wallet: true }));
      });
    apiListReservations(client, { scope: "all", limit: RESERVATIONS_LIMIT })
      .then((r) => {
        if (!live) return;
        setBookings(reservationEvents(r.reservations));
        setFailed((f) => ({ ...f, bookings: false }));
      })
      .catch(() => {
        if (live) setFailed((f) => ({ ...f, bookings: true }));
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce]);

  const all = useMemo(() => {
    if (!wallet && !bookings) return null;
    return [...(wallet ?? []), ...(bookings ?? [])].sort((a, b) =>
      a.at === b.at ? 0 : a.at === null ? 1 : b.at === null ? -1 : a.at < b.at ? 1 : -1,
    );
  }, [wallet, bookings]);

  const bothFailed = failed.wallet && failed.bookings;
  const loading = !all && !bothFailed;
  // Still reading the source this chip draws from.
  const waiting =
    filter === "all" ? loading : filter === "reservations" ? !bookings && !failed.bookings : !wallet && !failed.wallet;
  const shown = all ? (filter === "all" ? all : all.filter((e) => e.type === filter)) : null;
  const type = filter === "all" ? null : TYPES.find((t) => t.key === filter)!;
  const sourceFailed = filter === "all" ? bothFailed : filter === "reservations" ? failed.bookings : failed.wallet;

  return (
    <ActivityFrame
      rail={
        <TypeRail
          filter={filter}
          onPick={setFilter}
          counts={all ? countByType(all) : null}
        />
      }
    >
      {waiting ? (
        <RowsSkeleton />
      ) : sourceFailed && !shown?.length ? (
        <EmptyState
          icon={ReceiptText}
          title="Couldn't load activity"
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: () => setNonce((n) => n + 1) }}
        />
      ) : !shown?.length ? (
        <EmptyState
          icon={type?.Icon ?? ReceiptText}
          title={type ? `No ${type.label.toLowerCase()} yet` : "No activity yet"}
          description={type?.empty ?? "Reservations, payments, credit and cashback at Mesita places show up here."}
          action={{ label: "Find a place", href: CONSUMER_ROUTES.home }}
        />
      ) : (
        <ul className="border-border bg-card overflow-hidden rounded-2xl border" data-activity>
          {shown.map((ev, i) => (
            <Fragment key={ev.key}>
              {i > 0 && <RowDivider />}
              <li>
                <EventRow ev={ev} />
              </li>
            </Fragment>
          ))}
        </ul>
      )}
    </ActivityFrame>
  );
}

function countByType(evs: Ev[]): Record<TypeKey, number> {
  const c = Object.fromEntries(TYPES.map((t) => [t.key, 0])) as Record<TypeKey, number>;
  for (const e of evs) c[e.type] += 1;
  return c;
}

/** The horizontal catalog of event types: All, then every type. */
function TypeRail({
  filter,
  onPick,
  counts,
}: {
  filter: Filter;
  onPick: (f: Filter) => void;
  counts: Record<TypeKey, number> | null;
}) {
  const chips: { key: Filter; label: string; Icon: LucideIcon | null; n: number | null }[] = [
    { key: "all", label: "All", Icon: null, n: null },
    ...TYPES.map((t) => ({ key: t.key as Filter, label: t.label, Icon: t.Icon, n: counts ? counts[t.key] : null })),
  ];
  return (
    <div
      className="scrollbar-hide -mx-4 mt-3 flex snap-x gap-2 overflow-x-auto scroll-px-4 px-4"
      role="tablist"
      aria-label="Kinds of activity"
      data-activity-types
    >
      {chips.map(({ key, label, Icon, n }) => {
        const on = filter === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onPick(key)}
            className={cn(
              "flex h-9 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition",
              on ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
            {label}
            {n ? <span className={cn("tabular-nums", on ? "text-background/70" : "text-muted-foreground")}>{n}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function EventRow({ ev }: { ev: Ev }) {
  const Icon = ev.off ? Ban : TYPES.find((t) => t.key === ev.type)!.Icon;
  const body = (
    <>
      <span className="bg-muted text-foreground flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{ev.title}</span>
        <span className="text-muted-foreground block truncate text-xs">{ev.line}</span>
      </span>
      {ev.amount ? (
        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            ev.amount.cents > 0 ? "text-green-700" : "text-foreground",
          )}
        >
          {ev.amount.cents > 0 ? "+" : ""}
          {money(ev.amount.cents, ev.amount.currency)}
        </span>
      ) : null}
    </>
  );
  const cls = "flex min-h-16 items-center gap-3 px-4 py-2.5";
  return ev.href ? (
    <Link href={ev.href} className={cn(cls, "hover:bg-muted transition")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** The tab's frame: the white header bar Pay wears (MESITA-3534), the title
 *  and the type rail held at the top, then the page. The loading frame draws
 *  the same shape (MESITA-2701). */
export function ActivityFrame({ rail, children }: { rail?: ReactNode; children: ReactNode }) {
  return (
    <div className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8">
      <header className="border-border bg-card sticky top-0 z-10 -mx-4 border-b px-4 pt-5 pb-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Activity</h1>
        {rail ?? <RailSkeleton />}
      </header>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function RailSkeleton() {
  return (
    <div className="mt-3 flex gap-2 overflow-hidden" aria-hidden>
      {["w-12", "w-32", "w-28", "w-24", "w-24"].map((w, i) => (
        <Skeleton key={i} className={cn("h-9 shrink-0 rounded-full", w)} />
      ))}
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
          <div className="flex min-h-16 items-center gap-3 px-4 py-2.5">
            <Skeleton className="h-10 w-10 rounded-xl" />
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
