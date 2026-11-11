"use client";

// /activity — THE BAR'S ACTIVITY TAB (MESITA-3631), EVENTS AND TICKETS
// (MESITA-3688, Pato: "notifications are events; reservations, visits,
// payments, prepayments, gifts are tickets"; then "include favorites").
//
// Seven chips, in Pato's order (lib/activity-types.ts), the chosen one in the
// address (`?type=`), so Me's tiles, Back and a shared link land on it:
//
//   Notifications  events: NotificationsList under day headings, with the
//                  next reservation in 24 h above it as a "Next up" ticket
//   Favorites      the hearted places (FavoritesList; local, never fails)
//   Reservations   tickets: Upcoming, then Past
//   Visits         tickets: the guest's tabs (consumer-web-list-visits)
//   Payments       tickets: payments OUTSIDE a visit; a payment that paid a
//                  tab is that Visit's ticket (one meal, one ticket)
//   Prepayments    tickets: credits bought, Story vouchers waiting, refunds
//   Gifts          tickets: credit sent, received, taken back, links not taken
//
// Every source loads on mount and fails on its own; a chip's count shows only
// once its sources answered. This page never computes a balance: it lists
// and formats what the server sent.

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { KeptScroll } from "@/components/consumer/nav/KeptScroll";
import { NotificationsList } from "@/components/consumer/NotificationsClient";
import { FavoritesList } from "@/components/consumer/saved/FavoritesPage";
import { Skeleton } from "@/components/shared/Skeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { cn } from "@/lib/utils";
import {
  apiListReservations,
  RESERVATIONS_KEY,
  type EFReservationRow,
} from "@/lib/api/reservations";
import { apiListVisits, type GuestVisit } from "@/lib/api/tab";
import {
  apiGetWallet,
  ENTRY_LABEL,
  money,
  type Wallet,
  type WalletEntry,
} from "@/lib/api/wallet";
import {
  CONSUMER_ROUTES,
  payReceiptPath,
  payTabPath,
  reservationPath,
  walletPlacePath,
} from "@/lib/consumer-route-contract";
import {
  activityHref,
  activityTypeOf,
  type ActivityType,
} from "@/lib/activity-types";
import { reportError } from "@/lib/report-error";
import { stateMeta } from "@/lib/reservation-state";
import { toReservationItem } from "@/lib/reservations-adapter";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";
import { ACTIVITY_CHIPS } from "./activity-chips";
import {
  type PillTone,
  type Ticket,
  TicketCard,
  TicketSkeleton,
} from "./TicketCard";

type TicketType = Exclude<ActivityType, "notifications" | "favorites">;

/** One ticket and where it sorts: Upcoming soonest first, then Past newest
 *  first. */
type Row = Ticket & {
  type: TicketType;
  at: string | null;
  upcoming: boolean;
  paymentId?: string | null;
};

/** Each reservations read brings at most this many (the EF's cap). */
const RESERVATIONS_PAGE = 100;
const TTL = 2 * 60 * 1000;
const DAY_MS = 86_400_000;

/** "Nov 10": the date on a money ticket's line. */
function onDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

const join = (...parts: Array<string | null | false | undefined>) =>
  parts.filter(Boolean).join(" · ");

// ─── Reservations ───────────────────────────────────────────────────────────

type ReservationsRead = { rows: EFReservationRow[]; full: boolean };

function reservationRows(rows: EFReservationRow[], nowMs: number): Row[] {
  return rows.map((row) => {
    const item = toReservationItem(row);
    const live =
      item.state === "created" ||
      item.state === "booking" ||
      item.state === "confirmed";
    const at = item.reservedAt ?? row.reserved_at;
    const upcoming = live && Date.parse(at) >= nowMs;
    const label = stateMeta(item.state).label;
    const tone: PillTone =
      item.state === "confirmed" ? "green" : live ? "ink" : "grey";
    return {
      key: `r-${row.id}`,
      type: "reservations",
      at,
      upcoming,
      place: item.placeName,
      photo: item.placePhoto,
      pill: { label: label === "Passed" ? "Past" : label, tone },
      big: item.when,
      line: join(
        `${item.partySize} ${item.partySize === 1 ? "person" : "people"}`,
        item.referenceCode && `#${item.referenceCode}`,
      ),
      dim: item.state === "cancelled" || item.state === "failed",
      href: reservationPath(row.id),
    };
  });
}

// ─── Visits ─────────────────────────────────────────────────────────────────

const VISIT_PILL: Record<string, [string, PillTone]> = {
  waiting_bill: ["Open", "ink"],
  billed: ["Billed", "ink"],
  paying: ["Paying", "ink"],
  paid: ["Paid", "green"],
  expired: ["Expired", "grey"],
  cancelled: ["Cancelled", "grey"],
};

function visitRows(visits: GuestVisit[]): Row[] {
  return visits.map((v) => {
    const [label, tone] = VISIT_PILL[v.status] ?? [
      v.status,
      "grey" as PillTone,
    ];
    const open =
      v.status === "waiting_bill" ||
      v.status === "billed" ||
      v.status === "paying";
    return {
      key: `v-${v.tab_id}`,
      type: "visits",
      at: v.paid_at ?? v.created_at,
      upcoming: open,
      place: v.place.name ?? "A Mesita place",
      photo: v.place.photo_url,
      pill: { label, tone },
      big:
        v.bill_cents != null
          ? money(v.bill_cents + v.tip_cents, v.currency)
          : "Waiting for the bill",
      line: join(
        v.waiter_name,
        v.ticket && `#${v.ticket}`,
        onDay(v.created_at),
      ),
      dim: v.status === "expired" || v.status === "cancelled",
      href: payTabPath(v.tab_id),
    };
  });
}

// ─── The wallet: payments, prepayments, gifts ───────────────────────────────

const GIFT_PILL: Record<string, [string, PillTone]> = {
  gift_out: ["Sent", "ink"],
  gift_in: ["Received", "green"],
  gift_back: ["Taken back", "ink"],
};
const BOUGHT_KINDS = new Set(["prepay", "voucher"]);
const sum = (es: WalletEntry[]) => es.reduce((n, e) => n + e.amount_cents, 0);

function walletRows(w: Wallet): Row[] {
  const out: Row[] = [];
  for (const b of w.balances) {
    const place = b.place?.name ?? "A Mesita place";
    const photo = b.place?.photo ?? null;
    const cur = b.currency;
    const href = walletPlacePath(b.place_id);
    const byPayment = new Map<string, WalletEntry[]>();
    const bonuses = b.entries.filter((e) => e.kind === "bonus");
    const usedBonus = new Set<WalletEntry>();

    b.entries.forEach((e, i) => {
      if (
        e.payment_id &&
        (e.kind === "spend" || e.kind === "cashback" || e.kind === "reversal")
      ) {
        const g = byPayment.get(e.payment_id) ?? [];
        g.push(e);
        byPayment.set(e.payment_id, g);
        return;
      }
      if (e.kind === "spend" || e.kind === "cashback") {
        // An entry from before payments had ids: no receipt to open.
        out.push(
          paymentRow(
            `p-${b.place_id}-${e.at}-${i}`,
            place,
            photo,
            cur,
            [e],
            null,
            href,
          ),
        );
        return;
      }
      if (BOUGHT_KINDS.has(e.kind)) {
        const bonus = bonuses.find((x) => !usedBonus.has(x) && x.at === e.at);
        if (bonus) usedBonus.add(bonus);
        const pending = e.pending || !!bonus?.pending;
        out.push({
          key: `b-${b.place_id}-${e.at}-${i}`,
          type: "prepayments",
          at: e.at,
          upcoming: false,
          place,
          photo,
          pill: pending
            ? { label: "Pending", tone: "ink" }
            : { label: "Available", tone: "green" },
          big: money(e.amount_cents, cur),
          line: join(
            ENTRY_LABEL[e.kind] ?? e.kind,
            bonus && `+${money(bonus.amount_cents, cur)} bonus`,
            onDay(e.at),
          ),
          href,
        });
        return;
      }
      if (e.kind === "reversal") {
        // A purchase refunded (no payment id).
        out.push({
          key: `rv-${b.place_id}-${e.at}-${i}`,
          type: "prepayments",
          at: e.at,
          upcoming: false,
          place,
          photo,
          pill: { label: "Refunded", tone: "grey" },
          big: money(Math.abs(e.amount_cents), cur),
          line: join("Purchase refunded", onDay(e.at)),
          href,
        });
        return;
      }
      const gift = GIFT_PILL[e.kind];
      if (gift) {
        out.push({
          key: `g-${b.place_id}-${e.at}-${i}`,
          type: "gifts",
          at: e.at,
          upcoming: false,
          place,
          photo,
          pill: { label: gift[0], tone: gift[1] },
          big: money(Math.abs(e.amount_cents), cur),
          line: join(onDay(e.at), e.pending && "pending"),
          href,
        });
      }
    });

    // A bonus with no purchase beside it is its own prepayment ticket.
    for (const [i, e] of bonuses.entries()) {
      if (usedBonus.has(e)) continue;
      out.push({
        key: `bo-${b.place_id}-${e.at}-${i}`,
        type: "prepayments",
        at: e.at,
        upcoming: false,
        place,
        photo,
        pill: e.pending
          ? { label: "Pending", tone: "ink" }
          : { label: "Available", tone: "green" },
        big: money(e.amount_cents, cur),
        line: join("Bonus", onDay(e.at)),
        href,
      });
    }

    for (const [id, g] of byPayment)
      out.push(
        paymentRow(`p-${id}`, place, photo, cur, g, id, payReceiptPath(id)),
      );
  }

  // A Story voucher paid, waiting for the post (MESITA-3507).
  for (const s of w.waiting_stories ?? []) {
    out.push({
      key: `s-${s.purchase_id}`,
      type: "prepayments",
      at: s.paid_at,
      upcoming: false,
      place: s.place?.name ?? "A Mesita place",
      photo: s.place?.photo ?? null,
      pill: { label: "Waiting", tone: "ink" },
      big: money(s.credit_cents, s.currency),
      line: join(
        "Story voucher · waiting for your post",
        s.paid_at && onDay(s.paid_at),
      ),
      href: walletPlacePath(s.place_id),
    });
  }

  // A credit link sent that nobody took yet (MESITA-3292).
  const places = new Map(w.balances.map((b) => [b.place_id, b.place]));
  for (const l of w.sent_links ?? []) {
    const p = places.get(l.place_id);
    out.push({
      key: `gl-${l.gift_id}`,
      type: "gifts",
      at: l.created_at,
      upcoming: false,
      place: p?.name ?? "A Mesita place",
      photo: p?.photo ?? null,
      pill: { label: "Not taken", tone: "ink" },
      big: money(l.amount_cents, l.currency),
      line: join("Link sent", onDay(l.created_at)),
      href: walletPlacePath(l.place_id),
    });
  }
  return out;
}

/** One payment: the credits it used is the big fact; with none, the cashback
 *  it earned; with neither, "Paid in cash". A refund on it is a field and
 *  the pill. */
function paymentRow(
  key: string,
  place: string,
  photo: string | null,
  cur: string,
  g: WalletEntry[],
  paymentId: string | null,
  href: string,
): Row {
  const spend = g.filter((e) => e.kind === "spend");
  const cashback = g.filter((e) => e.kind === "cashback");
  const refund = g.filter((e) => e.kind === "reversal");
  const at = g.map((e) => e.at).sort()[0]!;
  const cash = cashback.some((e) => e.confirmed_by === "waiter");
  const back = sum(cashback);
  const big = spend.length
    ? money(Math.abs(sum(spend)), cur)
    : back
      ? `+${money(back, cur)} cashback`
      : "Paid in cash";
  return {
    key,
    type: "payments",
    paymentId,
    at,
    upcoming: false,
    place,
    photo,
    pill: refund.length
      ? { label: "Refunded", tone: "grey" }
      : { label: "Paid", tone: "green" },
    big,
    line: join(
      cash ? "Cash" : spend.length ? "Credits" : null,
      spend.length && back ? `+${money(back, cur)} cashback` : null,
      refund.length > 0 && `${money(Math.abs(sum(refund)), cur)} refunded`,
      onDay(at),
      g.some((e) => e.pending) && "pending",
    ),
    href,
  };
}

// ─── Ordering ───────────────────────────────────────────────────────────────

function ordered(rows: Row[]): { upcoming: Row[]; past: Row[] } {
  const t = (r: Row) => (r.at ? Date.parse(r.at) : 0);
  const upcoming = rows.filter((r) => r.upcoming).sort((a, b) => t(a) - t(b));
  const past = rows.filter((r) => !r.upcoming).sort((a, b) => t(b) - t(a));
  return { upcoming, past };
}

// ─── The page ───────────────────────────────────────────────────────────────

const EMPTY: Record<
  ActivityType,
  { title: string; action: { label: string; href: string } }
> = {
  notifications: {
    title: "Nothing new yet",
    action: { label: "Find a place", href: CONSUMER_ROUTES.home },
  },
  favorites: {
    title: "No favorites yet",
    action: { label: "Find a place", href: CONSUMER_ROUTES.home },
  },
  reservations: {
    title: "No reservations yet",
    action: { label: "Find a place", href: CONSUMER_ROUTES.home },
  },
  visits: {
    title: "No visits yet",
    action: { label: "Pay", href: CONSUMER_ROUTES.pay },
  },
  payments: {
    title: "No payments yet",
    action: { label: "Pay", href: CONSUMER_ROUTES.pay },
  },
  prepayments: {
    title: "No prepayments yet",
    action: { label: "Wallet", href: CONSUMER_ROUTES.wallet },
  },
  gifts: {
    title: "No gifts yet",
    action: { label: "Wallet", href: CONSUMER_ROUTES.wallet },
  },
};

const SOURCE_NAME: Record<TicketType, string> = {
  reservations: "reservations",
  visits: "visits",
  payments: "payments",
  prepayments: "prepayments",
  gifts: "gifts",
};

export function ActivityPage() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("type");
  const type = activityTypeOf(raw);
  const getSupabase = useLazyBrowserSupabase();

  // An unknown chip tidies its own address.
  useEffect(() => {
    if (
      raw !== null &&
      activityTypeOf(raw) === "notifications" &&
      raw !== "notifications"
    ) {
      router.replace(activityHref("notifications"));
    }
  }, [raw, router]);

  const reservations = useCachedQuery<ReservationsRead>(
    RESERVATIONS_KEY,
    async () => {
      const client = getSupabase();
      const [up, past] = await Promise.all([
        apiListReservations(client, {
          scope: "upcoming",
          limit: RESERVATIONS_PAGE,
        }),
        apiListReservations(client, {
          scope: "past",
          limit: RESERVATIONS_PAGE,
        }),
      ]);
      return {
        rows: [...up.reservations, ...past.reservations],
        full:
          up.reservations.length >= RESERVATIONS_PAGE ||
          past.reservations.length >= RESERVATIONS_PAGE,
      };
    },
    { ttl: TTL },
  );
  const wallet = useCachedQuery<Wallet>(
    "activity-wallet",
    () => apiGetWallet(getSupabase()),
    { ttl: TTL },
  );
  const visits = useCachedQuery(
    "activity-visits",
    () => apiListVisits(getSupabase()),
    { ttl: TTL },
  );

  useEffect(() => {
    for (const [what, err] of [
      ["visits", visits.error],
      ["wallet", wallet.error],
      ["reservations", reservations.error],
    ] as const) {
      if (err) reportError(`activity ${what} failed`, err);
    }
  }, [visits.error, wallet.error, reservations.error]);

  // The clock the page judges "upcoming" and "within a day" by: read once.
  const [nowMs] = useState(() => Date.now());

  const byType = useMemo(() => {
    const visitIds = new Set(
      (visits.data?.visits ?? []).flatMap((v) => v.part_payment_ids),
    );
    const money = wallet.data ? walletRows(wallet.data) : null;
    return {
      reservations: reservations.data
        ? reservationRows(reservations.data.rows, nowMs)
        : null,
      visits: visits.data ? visitRows(visits.data.visits) : null,
      // One meal, one ticket: a payment that paid a tab is its Visit.
      payments: money
        ? money.filter(
            (r) =>
              r.type === "payments" &&
              !(r.paymentId && visitIds.has(r.paymentId)),
          )
        : null,
      prepayments: money ? money.filter((r) => r.type === "prepayments") : null,
      gifts: money ? money.filter((r) => r.type === "gifts") : null,
    } satisfies Record<TicketType, Row[] | null>;
  }, [reservations.data, visits.data, wallet.data, nowMs]);

  // A source has answered, either way.
  const settled = {
    reservations: !reservations.loading,
    visits: !visits.loading,
    wallet: !wallet.loading,
  };
  // Payments waits for Visits too, so rows never vanish after they draw.
  const ready: Record<TicketType, boolean> = {
    reservations: settled.reservations,
    visits: settled.visits,
    payments: settled.wallet && settled.visits,
    prepayments: settled.wallet,
    gifts: settled.wallet,
  };
  const failed: Record<TicketType, boolean> = {
    reservations: !!reservations.error,
    visits: !!visits.error,
    payments: !!wallet.error,
    prepayments: !!wallet.error,
    gifts: !!wallet.error,
  };
  const retry: Record<TicketType, () => void> = {
    reservations: reservations.reload,
    visits: visits.reload,
    payments: () => {
      wallet.reload();
      visits.reload();
    },
    prepayments: wallet.reload,
    gifts: wallet.reload,
  };

  const counts: Partial<Record<ActivityType, string>> = {};
  for (const t of Object.keys(byType) as TicketType[]) {
    const rows = byType[t];
    if (!ready[t] || failed[t] || !rows) continue;
    if (t === "payments" && visits.error) continue; // duplicates possible: no number
    const capped =
      (t === "visits" && visits.data?.truncated) ||
      (t === "reservations" && reservations.data?.full);
    if (rows.length)
      counts[t] = capped ? `${rows.length}+` : String(rows.length);
  }

  // The reservation that comes next, within a day: "Next up".
  const nextUp = (() => {
    const rows = byType.reservations;
    if (!rows) return null;
    const soon = ordered(rows).upcoming.find(
      (r) =>
        r.pill.label === stateMeta("confirmed").label &&
        r.at &&
        Date.parse(r.at) - nowMs < DAY_MS,
    );
    return soon ?? null;
  })();

  const pick = (t: ActivityType) =>
    router.replace(activityHref(t), { scroll: false });

  return (
    <ActivityFrame
      rail={<TypeRail type={type} onPick={pick} counts={counts} />}
    >
      {type === "notifications" ? (
        <>
          {nextUp ? (
            <div className="mb-6">
              <TicketCard t={{ ...nextUp, label: "Next up" }} />
            </div>
          ) : null}
          <NotificationsList quietEmpty={!!nextUp} />
        </>
      ) : type === "favorites" ? (
        <FavoritesList />
      ) : (
        <Tickets
          type={type}
          rows={byType[type]}
          ready={ready[type]}
          failed={failed[type]}
          retry={retry[type]}
          note={
            type === "payments" && !!visits.error
              ? "Some payments may also appear under Visits."
              : null
          }
        />
      )}
    </ActivityFrame>
  );
}

function Tickets({
  type,
  rows,
  ready,
  failed,
  retry,
  note,
}: {
  type: TicketType;
  rows: Row[] | null;
  ready: boolean;
  failed: boolean;
  retry: () => void;
  note: string | null;
}) {
  const chip = ACTIVITY_CHIPS.find((c) => c.type === type)!;
  if (!ready) return <TicketsSkeleton />;
  if (failed || !rows) {
    return (
      <EmptyState
        icon={chip.Icon}
        title={`Couldn't load your ${SOURCE_NAME[type]}`}
        description="Check your connection and try again."
        action={{ label: "Try again", onClick: retry }}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={chip.Icon}
        title={EMPTY[type].title}
        action={EMPTY[type].action}
      />
    );
  }
  const { upcoming, past } = ordered(rows);
  const group = (title: string | null, list: Row[], first: boolean) =>
    list.length ? (
      <section className={cn(!first && "mt-6")}>
        {title ? (
          <h2 className="text-muted-foreground type-eyebrow mb-2">{title}</h2>
        ) : null}
        <ul className="flex flex-col gap-3" data-activity>
          {list.map((r, i) => (
            <li key={r.key}>
              <TicketCard
                t={
                  type === "reservations" && title === "Upcoming" && i === 0
                    ? { ...r, label: "Next up" }
                    : r
                }
              />
            </li>
          ))}
        </ul>
      </section>
    ) : null;
  // Only Reservations and Visits have tickets still ahead.
  const twoGroups = type === "reservations" || type === "visits";
  return (
    <>
      {note ? (
        <p className="text-muted-foreground mb-3 text-xs">{note}</p>
      ) : null}
      {twoGroups ? (
        <>
          {group("Upcoming", upcoming, true)}
          {group("Past", past, upcoming.length === 0)}
        </>
      ) : (
        group(null, past, true)
      )}
    </>
  );
}

/** The chips: the chosen one in view on arrival and on Back, without
 *  animation; the right edge fades so the rail reads as scrollable. */
function TypeRail({
  type,
  onPick,
  counts,
}: {
  type: ActivityType;
  onPick: (t: ActivityType) => void;
  counts: Partial<Record<ActivityType, string>>;
}) {
  const chosen = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    chosen.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant" as ScrollBehavior,
    });
  }, [type]);
  return (
    <div className="relative -mx-4 mt-3">
      <div
        className="scrollbar-hide flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pr-8"
        role="tablist"
        aria-label="Kinds of activity"
        data-activity-types
      >
        {ACTIVITY_CHIPS.map(({ type: key, label, Icon }) => {
          const on = type === key;
          const n = counts[key];
          return (
            <button
              key={key}
              ref={on ? chosen : undefined}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onPick(key)}
              className={cn(
                "flex h-11 shrink-0 snap-start items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition",
                on
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {label}
              {n ? (
                <span
                  className={cn(
                    "tabular-nums",
                    on ? "text-background/70" : "text-muted-foreground",
                  )}
                >
                  {n}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
      <span
        className="from-card pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent"
        aria-hidden
      />
    </div>
  );
}

/** The tab's frame: the white header bar Pay wears (MESITA-3534), the title
 *  and the chips held at the top, then the page. The loading frame draws the
 *  same shape (MESITA-2701). */
export function ActivityFrame({
  rail,
  children,
}: {
  rail?: ReactNode;
  children: ReactNode;
}) {
  return (
    <KeptScroll className="scrollbar-hide flex h-full min-h-0 flex-col overflow-y-auto px-4 pb-8">
      <header className="border-border bg-card sticky top-0 z-10 -mx-4 border-b px-4 pt-5 pb-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Activity
        </h1>
        {rail ?? <RailSkeleton />}
      </header>
      <div className="mt-5">{children}</div>
    </KeptScroll>
  );
}

function RailSkeleton() {
  return (
    <div className="mt-3 flex gap-2 overflow-hidden" aria-hidden>
      {["w-36", "w-28", "w-36", "w-24", "w-32"].map((w, i) => (
        <Skeleton key={i} className={cn("h-11 shrink-0 rounded-full", w)} />
      ))}
    </div>
  );
}

/** Three tickets' bones, on the list's step. */
export function TicketsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy>
      {[0, 1, 2].map((i) => (
        <TicketSkeleton key={i} />
      ))}
    </div>
  );
}
