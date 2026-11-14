"use client";

// ME'S THREE LISTS (Pato, 2026-11-14, MESITA-3855: "We are going to remove
// Activity too … Notifications, Reservations … Tickets includes the list of
// all the transactions: there are 4 types of tickets"). They were the bar's
// Activity tab and its chips (MESITA-3631, MESITA-3697, MESITA-3769) until
// Activity left the bar; each is a page under Me now, wearing Screen:
//
//   /me/notifications   events: NotificationsList under day headings, with
//                       the next confirmed reservation within a day above
//                       it as a "Next up" ticket
//   /me/reservations    Upcoming, then Past
//   /me/tickets         every ticket, newest first, open bills on top; one
//                       chip per kind narrows it, /me/tickets/<kind>:
//     Visits    the guest's tabs (consumer-web-list-visits) AND the
//               payments. A payment that paid a tab is written on that
//               Visit's card (one meal, one ticket); any other payment is
//               its own ticket
//     Vouchers  credits bought, bonuses, Story vouchers waiting
//     Gifts     credit sent, received, taken back, links not taken
//     Refunds   purchases refunded (under Vouchers until MESITA-3855)
//
// Every source loads on mount and fails on its own; a chip's count shows only
// once its sources answered. Nothing here computes a balance: it lists and
// formats what the server sent.

import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  CalendarCheck,
  Gift,
  HandCoins,
  Ticket,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Screen } from "@/components/consumer/nav/Screen";
import { NotificationsList } from "@/components/consumer/NotificationsClient";
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
  WALLET_CACHE_KEY,
  type Wallet,
  type WalletEntry,
} from "@/lib/api/wallet";
import {
  CONSUMER_ROUTES,
  payReceiptPath,
  payTabPath,
  creditEntryPath,
  reservationPath,
  visitPath,
  walletPlacePath,
} from "@/lib/consumer-route-contract";
import {
  isTicketKind,
  TICKET_KINDS,
  ticketsHref,
  type TicketKind,
} from "@/lib/ticket-kinds";
import { reportError } from "@/lib/report-error";
import { stateMeta } from "@/lib/reservation-state";
import { toReservationItem } from "@/lib/reservations-adapter";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";
import { ChipIntro } from "./ChipIntro";
import {
  type ActivityItem,
  ActivityRow,
  ActivityRows,
  ActivityRowsSkeleton,
  type StatusTone,
} from "./ActivityRow";

/** A list of tickets: Reservations, or one kind of ticket. */
type ListType = "reservations" | TicketKind;

/** One ticket and where it sorts: Upcoming soonest first, then Past newest
 *  first. */
type Row = ActivityItem & {
  type: ListType;
  at: string | null;
  upcoming: boolean;
  paymentId?: string | null;
  /** A payment's facts in a few words, for the Visit card it paid. */
  payNote?: string | null;
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
    const tone: StatusTone =
      item.state === "confirmed" ? "green" : live ? "ink" : "grey";
    return {
      key: `r-${row.id}`,
      type: "reservations",
      at,
      upcoming,
      place: item.placeName,
      photo: item.placePhoto,
      // No "Past" on the row: its group says it (MESITA-3778, Pato: "don't
      // show the fucking past").
      status: { label: label === "Passed" ? "" : label, tone },
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

const VISIT_PILL: Record<string, [string, StatusTone]> = {
  waiting_bill: ["Open", "ink"],
  billed: ["Billed", "ink"],
  paying: ["Paying", "ink"],
  paid: ["Paid", "green"],
  expired: ["Expired", "grey"],
  cancelled: ["Cancelled", "grey"],
};

/** `notes`: each payment's few words by its id, written on the Visit it
 *  paid (MESITA-3697: the payment lives on its Visit's card). */
function visitRows(visits: GuestVisit[], notes: Map<string, string>): Row[] {
  return visits.map((v) => {
    const [label, tone] = VISIT_PILL[v.status] ?? [
      v.status,
      "grey" as StatusTone,
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
      status: { label, tone },
      big:
        v.bill_cents != null
          ? money(v.bill_cents + v.tip_cents, v.currency)
          : "Waiting for the bill",
      money: v.bill_cents != null,
      line: join(
        v.waiter_name,
        v.ticket && `Ticket ${v.ticket}`,
        ...v.part_payment_ids.map((id) => notes.get(id)),
        onDay(v.created_at),
      ),
      dim: v.status === "expired" || v.status === "cancelled",
      // An open bill is the live pay screen; a finished one is its one-page
      // summary (MESITA-3770: "the live workflow and the output must be
      // different").
      href: open ? payTabPath(v.tab_id) : visitPath(v.tab_id),
    };
  });
}

// ─── The wallet: payments, vouchers, gifts ───────────────────────────────

const GIFT_PILL: Record<string, [string, StatusTone]> = {
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
          type: "vouchers",
          at: e.at,
          upcoming: false,
          place,
          photo,
          status: pending
            ? { label: "Pending", tone: "ink" }
            : { label: "Available", tone: "green" },
          big: money(e.amount_cents, cur),
          money: true,
          line: join(
            ENTRY_LABEL[e.kind] ?? e.kind,
            bonus && `+${money(bonus.amount_cents, cur)} bonus`,
            onDay(e.at),
          ),
          href: creditEntryPath(b.place_id, e),
        });
        return;
      }
      if (e.kind === "reversal") {
        // A purchase refunded (no payment id): a Refund ticket (MESITA-3855;
        // it sat under Vouchers until then).
        out.push({
          key: `rv-${b.place_id}-${e.at}-${i}`,
          type: "refunds",
          at: e.at,
          upcoming: false,
          place,
          photo,
          status: { label: "Refunded", tone: "grey" },
          big: money(Math.abs(e.amount_cents), cur),
          money: true,
          line: join("Purchase refunded", onDay(e.at)),
          href: creditEntryPath(b.place_id, e),
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
          status: { label: gift[0], tone: gift[1] },
          big: money(Math.abs(e.amount_cents), cur),
          money: true,
          line: join(onDay(e.at), e.pending && "pending"),
          href: creditEntryPath(b.place_id, e),
        });
      }
    });

    // A bonus with no purchase beside it is its own prepayment ticket.
    for (const [i, e] of bonuses.entries()) {
      if (usedBonus.has(e)) continue;
      out.push({
        key: `bo-${b.place_id}-${e.at}-${i}`,
        type: "vouchers",
        at: e.at,
        upcoming: false,
        place,
        photo,
        status: e.pending
          ? { label: "Pending", tone: "ink" }
          : { label: "Available", tone: "green" },
        big: money(e.amount_cents, cur),
          money: true,
        line: join("Bonus", onDay(e.at)),
        href: creditEntryPath(b.place_id, e),
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
      type: "vouchers",
      at: s.paid_at,
      upcoming: false,
      place: s.place?.name ?? "A Mesita place",
      photo: s.place?.photo ?? null,
      status: { label: "Waiting", tone: "ink" },
      big: money(s.credit_cents, s.currency),
          money: true,
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
      status: { label: "Not taken", tone: "ink" },
      big: money(l.amount_cents, l.currency),
          money: true,
      line: join("Link sent", onDay(l.created_at)),
      href: walletPlacePath(l.place_id),
    });
  }
  return out;
}

/** One payment: the credits it used is the big fact; with none, the cashback
 *  it earned; with neither, "Paid in cash". A refund on it is a field and
 *  the state. */
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
    type: "visits",
    paymentId,
    payNote:
      join(
        spend.length > 0 && `${money(Math.abs(sum(spend)), cur)} in credits`,
        back ? `+${money(back, cur)} cashback` : null,
        refund.length > 0 && `${money(Math.abs(sum(refund)), cur)} refunded`,
      ) || null,
    at,
    upcoming: false,
    place,
    photo,
    status: refund.length
      ? { label: "Refunded", tone: "grey" }
      : { label: "Paid", tone: "green" },
    big,
    money: true,
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

// ─── The reads ──────────────────────────────────────────────────────────────

function useReservations() {
  const getSupabase = useLazyBrowserSupabase();
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
  useEffect(() => {
    if (reservations.error)
      reportError("me reservations failed", reservations.error);
  }, [reservations.error]);
  // The clock the page judges "upcoming" and "within a day" by: read once.
  const [nowMs] = useState(() => Date.now());
  const rows = useMemo(
    () =>
      reservations.data
        ? reservationRows(reservations.data.rows, nowMs)
        : null,
    [reservations.data, nowMs],
  );
  return { ...reservations, rows, nowMs };
}

// ─── The pages ──────────────────────────────────────────────────────────────

const EMPTY: Record<
  ListType | "all",
  { title: string; text: string; action?: { label: string; href: string } }
> = {
  reservations: {
    title: "No reservations yet",
    text: "Book a table from any place's page and it lands here.",
    action: { label: "Find a place", href: CONSUMER_ROUTES.home },
  },
  all: {
    title: "No tickets yet",
    text: "Every visit, voucher, gift and refund lands here.",
    action: { label: "Pay", href: CONSUMER_ROUTES.pay },
  },
  visits: {
    title: "No visits yet",
    text: "Pay a bill with Mesita at the table and its full statement lands here.",
    action: { label: "Pay", href: CONSUMER_ROUTES.pay },
  },
  vouchers: {
    title: "No vouchers yet",
    text: "Open a place that sells credit and buy some from its Vouchers tab.",
    action: { label: "Find a place", href: CONSUMER_ROUTES.search },
  },
  gifts: {
    title: "No gifts yet",
    text: "Credit you send to a friend, or a friend sends you, lands here.",
    action: { label: "Gift credit", href: CONSUMER_ROUTES.mePages.gift },
  },
  // Refunds' words since MESITA-3771, kept (MESITA-3782).
  refunds: {
    title: "No refunds",
    text: "Any refund Mesita gives you shows up here, with the place and the amount.",
  },
};

/** The Tickets chips, in Pato's order (MESITA-3855): All, then the four
 *  kinds. */
const CHIPS: ReadonlyArray<{
  kind: TicketKind | "all";
  label: string;
  Icon: LucideIcon;
}> = [
  { kind: "all", label: "All", Icon: Ticket },
  { kind: "visits", label: "Visits", Icon: UtensilsCrossed },
  { kind: "vouchers", label: "Vouchers", Icon: BadgeDollarSign },
  { kind: "gifts", label: "Gifts", Icon: Gift },
  { kind: "refunds", label: "Refunds", Icon: HandCoins },
];

const ICON: Record<ListType | "all", LucideIcon> = {
  reservations: CalendarCheck,
  all: Ticket,
  visits: UtensilsCrossed,
  vouchers: BadgeDollarSign,
  gifts: Gift,
  refunds: HandCoins,
};

/** /me/notifications: what Mesita told you, the next table on top. */
export function NotificationsPage() {
  const reservations = useReservations();
  const nextUp =
    (reservations.rows
      ? ordered(reservations.rows).upcoming.find(
          (r) =>
            r.status.label === stateMeta("confirmed").label &&
            r.at &&
            Date.parse(r.at) - reservations.nowMs < DAY_MS,
        )
      : null) ?? null;
  return (
    <Screen title="Notifications">
      <div className="flex flex-col gap-4">
        <ChipIntro type="notifications" />
        {nextUp ? (
          <ActivityRows>
            <ActivityRow t={{ ...nextUp, label: "Next up" }} />
          </ActivityRows>
        ) : null}
        <NotificationsList quietEmpty={!!nextUp} />
      </div>
    </Screen>
  );
}

/** /me/reservations: Upcoming, then Past. */
export function ReservationsPage() {
  const reservations = useReservations();
  return (
    <Screen title="Reservations">
      <div className="flex flex-col gap-4">
        <ChipIntro type="reservations" />
        <TicketList
          type="reservations"
          rows={reservations.rows}
          ready={!reservations.loading}
          failed={!!reservations.error}
          retry={reservations.reload}
          note={null}
        />
      </div>
    </Screen>
  );
}

/** /me/tickets and /me/tickets/<kind>: every transaction, one chip per kind. */
export function TicketsPage() {
  // THE CHIP IS THE PATH (as Activity's was, MESITA-3811): /me/tickets/<kind>;
  // bare /me/tickets is All. The kind page turns unknown names away.
  const pathname = usePathname() ?? CONSUMER_ROUTES.mePages.tickets;
  const seg = pathname.split("/")[3];
  const kind: TicketKind | "all" = isTicketKind(seg) ? seg : "all";
  const getSupabase = useLazyBrowserSupabase();

  // The keys Activity used, so CreditEntry's read stays shared.
  const wallet = useCachedQuery<Wallet>(
    WALLET_CACHE_KEY,
    () => apiGetWallet(getSupabase()),
    { ttl: TTL },
  );
  const visits = useCachedQuery(
    "activity-visits",
    () => apiListVisits(getSupabase()),
    { ttl: TTL },
  );
  useEffect(() => {
    if (visits.error) reportError("me tickets visits failed", visits.error);
    if (wallet.error) reportError("me tickets wallet failed", wallet.error);
  }, [visits.error, wallet.error]);

  const byKind = useMemo(() => {
    const visitIds = new Set(
      (visits.data?.visits ?? []).flatMap((v) => v.part_payment_ids),
    );
    const moneyRows = wallet.data ? walletRows(wallet.data) : null;
    const payments = moneyRows
      ? moneyRows.filter((r) => r.type === "visits")
      : [];
    const notes = new Map(
      payments.flatMap((r) =>
        r.paymentId && r.payNote ? [[r.paymentId, r.payNote] as const] : [],
      ),
    );
    const of = (k: TicketKind) =>
      moneyRows ? moneyRows.filter((r) => r.type === k) : null;
    return {
      // One meal, one ticket: a payment that paid a tab is written on its
      // Visit; every other payment is a ticket of its own beside them.
      visits: visits.data
        ? [
            ...visitRows(visits.data.visits, notes),
            ...payments.filter(
              (r) => !(r.paymentId && visitIds.has(r.paymentId)),
            ),
          ]
        : null,
      vouchers: of("vouchers"),
      gifts: of("gifts"),
      refunds: of("refunds"),
    } satisfies Record<TicketKind, Row[] | null>;
  }, [visits.data, wallet.data]);

  const walletReady = !wallet.loading;
  // Visits waits for the wallet too, so its payments never pop in late.
  const ready = (k: TicketKind | "all") =>
    k === "visits" || k === "all" ? !visits.loading && walletReady : walletReady;
  const failed = (k: TicketKind | "all") =>
    k === "visits"
      ? !!visits.error
      : k === "all"
        ? !!visits.error && !!wallet.error
        : !!wallet.error;
  const retry = () => {
    if (visits.error) visits.reload();
    if (wallet.error) wallet.reload();
  };
  const rowsOf = (k: TicketKind | "all"): Row[] | null => {
    if (k !== "all") return byKind[k];
    const parts = TICKET_KINDS.map((t) => byKind[t]);
    if (parts.every((p) => p === null)) return null;
    return parts.flatMap((p) => p ?? []);
  };

  const counts: Partial<Record<TicketKind | "all", string>> = {};
  for (const c of CHIPS) {
    const rows = rowsOf(c.kind);
    if (!ready(c.kind) || failed(c.kind) || !rows || !rows.length) continue;
    // Payments missing: no number on a list they belong to.
    if ((c.kind === "visits" || c.kind === "all") && wallet.error) continue;
    const capped =
      (c.kind === "visits" || c.kind === "all") && visits.data?.truncated;
    counts[c.kind] = capped ? `${rows.length}+` : String(rows.length);
  }

  const note =
    (kind === "visits" || kind === "all") && !!wallet.error
      ? "Couldn't load your payments. Visits shows your tables only."
      : kind === "all" && !!visits.error
        ? "Couldn't load your visits. Showing the rest."
        : null;

  // A chip tap rewrites the address in place: no navigation, so no loading
  // frame between chips; Next keeps usePathname in step (MESITA-3811).
  const pick = (k: TicketKind | "all") =>
    window.history.replaceState(
      null,
      "",
      k === "all" ? ticketsHref() : ticketsHref(k),
    );

  return (
    <Screen title="Tickets">
      <div className="flex flex-col gap-4">
        <KindRail kind={kind} onPick={pick} counts={counts} />
        {/* Each kind says what it holds first (MESITA-3782); All lists them. */}
        {kind !== "all" ? <ChipIntro type={kind} /> : null}
        <TicketList
          type={kind}
          rows={rowsOf(kind)}
          ready={ready(kind)}
          failed={failed(kind)}
          retry={retry}
          note={note}
        />
      </div>
    </Screen>
  );
}

function TicketList({
  type,
  rows,
  ready,
  failed,
  retry,
  note,
}: {
  type: ListType | "all";
  rows: Row[] | null;
  ready: boolean;
  failed: boolean;
  retry: () => void;
  note: string | null;
}) {
  const Icon = ICON[type];
  if (!ready) return <ActivityRowsSkeleton />;
  if (failed || !rows) {
    return (
      <EmptyState
        icon={Icon}
        title={`Couldn't load your ${type === "all" ? "tickets" : type}`}
        description="Check your connection and try again."
        action={{ label: "Try again", onClick: retry }}
      />
    );
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={Icon}
        title={EMPTY[type].title}
        description={EMPTY[type].text}
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
        <ActivityRows>
          {list.map((r) => (
            <ActivityRow
              key={r.key}
              t={
                type === "reservations" && r.key === upcoming[0]?.key
                  ? { ...r, label: "Next up" }
                  : r
              }
            />
          ))}
        </ActivityRows>
      </section>
    ) : null;
  // Only Reservations and Visits (and All, which holds Visits) have tickets
  // still ahead.
  const twoGroups =
    type === "reservations" || type === "visits" || type === "all";
  return (
    <div>
      {note ? (
        <p className="text-muted-foreground mb-3 text-xs">{note}</p>
      ) : null}
      {twoGroups && upcoming.length > 0 && past.length > 0 ? (
        <>
          {group("Upcoming", upcoming, true)}
          {group("Past", past, false)}
        </>
      ) : twoGroups && upcoming.length > 0 ? (
        // One group, no heading (MESITA-3778): a lone "Past" or "Upcoming"
        // only repeated what every row said.
        group(null, upcoming, true)
      ) : (
        group(null, past, true)
      )}
    </div>
  );
}

/** The chips: the chosen one in view on arrival and on Back, without
 *  animation; the right edge fades so the rail reads as scrollable. */
function KindRail({
  kind,
  onPick,
  counts,
}: {
  kind: TicketKind | "all";
  onPick: (k: TicketKind | "all") => void;
  counts: Partial<Record<TicketKind | "all", string>>;
}) {
  const chosen = useRef<HTMLButtonElement | null>(null);
  useLayoutEffect(() => {
    chosen.current?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: "instant" as ScrollBehavior,
    });
  }, [kind]);
  return (
    <div className="relative -mx-4">
      <div
        className="scrollbar-hide flex snap-x scroll-px-4 gap-2 overflow-x-auto px-4 pr-8"
        role="tablist"
        aria-label="Kinds of ticket"
        data-ticket-kinds
      >
        {CHIPS.map(({ kind: key, label, Icon }) => {
          const on = kind === key;
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
        className="from-background pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l to-transparent"
        aria-hidden
      />
    </div>
  );
}

// ─── The loading frames (MESITA-2701) ──────────────────────────────────────

/** A list page's frame while its read is out: the title in place, the list
 *  in bones; Tickets also draws its chips' bones. */
export function MeListSkeleton({
  title,
  rail = false,
}: {
  title: string;
  rail?: boolean;
}) {
  return (
    <Screen title={title}>
      <div className="flex flex-col gap-4">
        {rail ? (
          <div className="flex gap-2 overflow-hidden" aria-hidden>
            {["w-20", "w-28", "w-32", "w-24", "w-28"].map((w, i) => (
              <Skeleton
                key={i}
                className={cn("h-11 shrink-0 rounded-full", w)}
              />
            ))}
          </div>
        ) : null}
        <ActivityRowsSkeleton />
        <p role="status" className="sr-only">
          Loading {title.toLowerCase()}
        </p>
      </div>
    </Screen>
  );
}
