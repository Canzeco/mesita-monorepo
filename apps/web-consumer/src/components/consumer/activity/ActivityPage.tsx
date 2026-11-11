"use client";

// /activity — THE BAR'S ACTIVITY TAB (Pato, 2026-11-09, MESITA-3631: "Home
// Search Pay Activity Me"). It was Me › Transactions, /me/transactions
// (MESITA-3465), which now 308s here.
//
// A RAIL OF EVENT TYPES OVER ONE FEED (Pato, MESITA-3633: "Show horizontal
// catalog or something of types of events"): under the title, a horizontal
// rail of chips, All first. FOUR TYPES SINCE MESITA-3641 (Pato: "Payments,
// Prepayments, Gifts, Reservations — so the cashback is a field in a
// payment event. and bonus is a field in prepayment event"). Every chip is
// always there; an empty one says so. The feed is newest first and is built
// only from what the server sends:
//
//   Payments       one row per payment_id: the credit spent (spend) and the
//                  cashback it earned, together; "Paid in cash" when staff
//                  confirmed it (MESITA-3554); a refund on it is a field.
//                  Opens the receipt.
//   Prepayments    one row per purchase: credits bought (prepay) or a
//                  voucher, with the bonus credited at the same place and
//                  moment as a field; a Story voucher waiting for its post
//                  (MESITA-3507) is one too.
//   Gifts          credit sent to or taken from a friend, and links not
//                  taken yet (MESITA-3292)
//   Reservations   consumer-web-list-reservations (when it was made, its
//                  state, the time and the party)
//
// The money lines are the Wallet's own entries (consumer-web-get-wallet).
// This page never computes a balance; it lists and formats what the server
// sent (a payment's cashback entries are summed into its one field). Each source fails on its own: a failed one leaves the other's rows.

import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { Fragment, type ReactNode, useEffect, useMemo, useState } from "react";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { Activity as ActivityIcon, Ban, CalendarCheck, Gift, type LucideIcon, ReceiptText, Wallet as WalletIcon } from "lucide-react";

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

type TypeKey = "payments" | "prepayments" | "gifts" | "reservations";

/** The rail, in order, after All (Pato's order, MESITA-3641). `empty` is
 *  the chip's empty line. */
const TYPES: readonly { key: TypeKey; label: string; Icon: LucideIcon; empty: string }[] = [
  { key: "payments", label: "Payments", Icon: ReceiptText, empty: "Bills you pay with Mesita show up here, with their cashback." },
  { key: "prepayments", label: "Prepayments", Icon: WalletIcon, empty: "Credits and vouchers you buy at a place show up here, with their bonus." },
  { key: "gifts", label: "Gifts", Icon: Gift, empty: "Credit you send or get from a friend shows up here." },
  { key: "reservations", label: "Reservations", Icon: CalendarCheck, empty: "Tables you book show up here." },
];

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

const GIFT_KINDS = new Set(["gift_out", "gift_in", "gift_back"]);
const BOUGHT_KINDS = new Set(["prepay", "voucher"]);

/** "$2.00 cashback": a field on its row, never a row of its own. */
const field = (cents: number, currency: string, what: string) => `${money(Math.abs(cents), currency)} ${what}`;

function walletEvents(w: Wallet): Ev[] {
  const out: Ev[] = [];
  for (const b of w.balances) {
    const place = b.place?.name ?? "A Mesita place";
    const cur = b.currency;

    // PAYMENTS: every entry naming a payment, grouped by it.
    const byPayment = new Map<string, WalletEntry[]>();
    // PREPAYMENTS: a bonus rides on the purchase credited at the same moment.
    const bonuses = b.entries.filter((e) => e.kind === "bonus");
    const usedBonus = new Set<WalletEntry>();

    b.entries.forEach((e, i) => {
      if (e.payment_id && (e.kind === "spend" || e.kind === "cashback" || e.kind === "reversal")) {
        const g = byPayment.get(e.payment_id) ?? [];
        g.push(e);
        byPayment.set(e.payment_id, g);
        return;
      }
      if (e.kind === "spend" || e.kind === "cashback") {
        // An entry from before payments had ids: a payment row of its own.
        out.push(paymentEvent(`p-${b.place_id}-${e.at}-${i}`, place, cur, [e], null));
        return;
      }
      if (BOUGHT_KINDS.has(e.kind)) {
        const bonus = bonuses.find((x) => !usedBonus.has(x) && x.at === e.at);
        if (bonus) usedBonus.add(bonus);
        const parts = [ENTRY_LABEL[e.kind] ?? e.kind, entryDate(e.at)];
        if (bonus) parts.push(`+${field(bonus.amount_cents, cur, "bonus")}`);
        if (e.pending || bonus?.pending) parts.push("pending");
        out.push({
          key: `b-${b.place_id}-${e.at}-${i}`,
          type: "prepayments",
          at: e.at,
          title: place,
          line: parts.join(" · "),
          amount: { cents: e.amount_cents, currency: cur },
          href: walletPlacePath(b.place_id),
        });
        return;
      }
      if (e.kind === "reversal") {
        // A purchase refunded (no payment id): it belongs to Prepayments.
        out.push({
          key: `r-${b.place_id}-${e.at}-${i}`,
          type: "prepayments",
          at: e.at,
          title: place,
          line: `Refunded · ${entryDate(e.at)}`,
          amount: { cents: e.amount_cents, currency: cur },
          href: walletPlacePath(b.place_id),
        });
        return;
      }
      if (GIFT_KINDS.has(e.kind)) {
        out.push({
          key: `g-${b.place_id}-${e.at}-${i}`,
          type: "gifts",
          at: e.at,
          title: place,
          line: `${ENTRY_LABEL[e.kind] ?? e.kind} · ${entryDate(e.at)}${e.pending ? " · pending" : ""}`,
          amount: { cents: e.amount_cents, currency: cur },
          href: walletPlacePath(b.place_id),
        });
      }
    });

    // A bonus with no purchase beside it still shows, as its own prepayment.
    for (const [i, e] of bonuses.entries()) {
      if (usedBonus.has(e)) continue;
      out.push({
        key: `bo-${b.place_id}-${e.at}-${i}`,
        type: "prepayments",
        at: e.at,
        title: place,
        line: `Bonus · ${entryDate(e.at)}${e.pending ? " · pending" : ""}`,
        amount: { cents: e.amount_cents, currency: cur },
        href: walletPlacePath(b.place_id),
      });
    }

    for (const [id, g] of byPayment) out.push(paymentEvent(`p-${id}`, place, cur, g, id));
  }
  for (const s of w.waiting_stories ?? []) {
    out.push({
      key: `s-${s.purchase_id}`,
      type: "prepayments",
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
      key: `gl-${l.gift_id}`,
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

/** One payment: the credit it spent on the right; its cashback and any
 *  refund as fields on the line. Its time is the earliest of its entries. */
function paymentEvent(key: string, place: string, cur: string, g: WalletEntry[], paymentId: string | null): Ev {
  const spend = g.find((e) => e.kind === "spend");
  const cashback = g.filter((e) => e.kind === "cashback");
  const refund = g.filter((e) => e.kind === "reversal");
  const at = g.map((e) => e.at).sort()[0];
  const cash = cashback.some((e) => e.confirmed_by === "waiter");
  const sum = (es: WalletEntry[]) => es.reduce((n, e) => n + e.amount_cents, 0);
  const parts = [cash ? "Paid in cash" : "Paid", entryDate(at)];
  if (cashback.length) parts.push(`+${field(sum(cashback), cur, "cashback")}`);
  if (refund.length) parts.push(`${field(sum(refund), cur, "refunded")}`);
  if (g.some((e) => e.pending)) parts.push("pending");
  return {
    key,
    type: "payments",
    at,
    title: place,
    line: parts.join(" · "),
    amount: spend ? { cents: spend.amount_cents, currency: cur } : undefined,
    href: paymentId ? payReceiptPath(paymentId) : undefined,
  };
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
          icon={ActivityIcon}
          title="Couldn't load activity"
          description="Check your connection and try again."
          action={{ label: "Try again", onClick: () => setNonce((n) => n + 1) }}
        />
      ) : !shown?.length ? (
        <EmptyState
          icon={type?.Icon ?? ActivityIcon}
          title={type ? `No ${type.label.toLowerCase()} yet` : "No activity yet"}
          description={type?.empty ?? "Payments, prepayments, gifts and reservations at Mesita places show up here."}
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
    <PushLink href={ev.href} className={cn(cls, "hover:bg-muted transition")}>
      {body}
    </PushLink>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** The tab's frame: the white header bar Pay wears (MESITA-3534), the title
 *  and the type rail held at the top, then the page. The loading frame draws
 *  the same shape (MESITA-2701). */
export function ActivityFrame({ rail, children }: { rail?: ReactNode; children: ReactNode }) {
  return (
    <KeptScroll className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8">
      <header className="border-border bg-card sticky top-0 z-10 -mx-4 border-b px-4 pt-5 pb-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Activity</h1>
        {rail ?? <RailSkeleton />}
      </header>
      <div className="mt-5">{children}</div>
    </KeptScroll>
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
