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
//   /me/tickets         every ticket under the day it happened, newest
//                       first; a bill still open sits above them in its own
//                       "Open now" card with its button (MESITA-3865). The
//                       chips All · Visits · Vouchers · Gifts are always
//                       there (MESITA-3882), Refunds once it holds one; a
//                       chip narrows the list, /me/tickets/<kind>:
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

import { useEffect, useMemo, useState } from "react";
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

/** "21:42": the time a money ticket's line starts with. Its day is the
 *  heading it sits under (MESITA-3865: three payments on one day read alike
 *  with a date alone). */
function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** A day's key in the guest's own clock, for grouping. */
function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** A day group's heading: Today, Yesterday, else "Wed, Nov 11" (with the
 *  year once it is not this one). */
function dayTitle(iso: string, nowMs: number): string {
  const ms = Date.parse(iso);
  if (dayKey(ms) === dayKey(nowMs)) return "Today";
  if (dayKey(ms) === dayKey(nowMs - DAY_MS)) return "Yesterday";
  const d = new Date(ms);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year:
      d.getFullYear() === new Date(nowMs).getFullYear() ? undefined : "numeric",
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
/** A bill still open: the live pay screen, Tickets' "Open now" card, and
 *  the red dot on Me's Tickets box (MESITA-3885). */
export function isOpenVisit(v: Pick<GuestVisit, "status">): boolean {
  return (
    v.status === "waiting_bill" ||
    v.status === "billed" ||
    v.status === "paying"
  );
}

function visitRows(visits: GuestVisit[], notes: Map<string, string>): Row[] {
  return visits.map((v) => {
    const [label, tone] = VISIT_PILL[v.status] ?? [
      v.status,
      "grey" as StatusTone,
    ];
    const open = isOpenVisit(v);
    // Nothing was paid: the bill is a grey fact on the line, never an amount
    // on the right beside money that moved (MESITA-3865).
    const unpaid = v.status === "expired" || v.status === "cancelled";
    const at = v.paid_at ?? v.created_at;
    const total =
      v.bill_cents != null
        ? money(v.bill_cents + v.tip_cents, v.currency)
        : null;
    // An open bill is the live pay screen; a finished one is its one-page
    // summary (MESITA-3770: "the live workflow and the output must be
    // different").
    const href = open ? payTabPath(v.tab_id) : visitPath(v.tab_id);
    return {
      key: `v-${v.tab_id}`,
      type: "visits",
      at,
      upcoming: open,
      place: v.place.name ?? "A Mesita place",
      photo: v.place.photo_url,
      status: { label, tone },
      big: unpaid ? "" : (total ?? "Waiting for the bill"),
      money: !unpaid && total != null,
      line: join(
        open ? `Started ${clock(v.created_at)}` : clock(at),
        unpaid && total && `${total} bill`,
        ...v.part_payment_ids.map((id) => notes.get(id)),
        v.waiter_name,
        v.ticket && `Ticket ${v.ticket}`,
      ),
      dim: unpaid,
      href,
      action: open
        ? { label: total ? "Continue paying" : "Open", href }
        : undefined,
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
            clock(e.at),
            ENTRY_LABEL[e.kind] ?? e.kind,
            bonus && `+${money(bonus.amount_cents, cur)} bonus`,
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
          line: join(clock(e.at), "Purchase refunded"),
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
          line: join(clock(e.at), e.pending && "pending"),
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
        line: join(clock(e.at), "Bonus"),
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
        s.paid_at && clock(s.paid_at),
        "Story voucher · waiting for your post",
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
      line: join(clock(l.created_at), "Link sent"),
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
      clock(at),
      cash ? "Cash" : spend.length ? "Credits" : null,
      spend.length && back ? `+${money(back, cur)} cashback` : null,
      refund.length > 0 && `${money(Math.abs(sum(refund)), cur)} refunded`,
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

/** Me › Reservations' read, shared by key with Me's Reservations box
 *  (MESITA-3885). */
export function useReservations() {
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
      reservations.data ? reservationRows(reservations.data.rows, nowMs) : null,
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

/** Tickets' tabs (MESITA-3893, Pato: "remove all. just Visits. Vouchers.
 *  Gifts"). Refunds sit in Vouchers, as they did before MESITA-3855. */
type TicketTab = "visits" | "vouchers" | "gifts";
const TICKET_TABS: ReadonlyArray<{ kind: TicketTab; label: string }> = [
  { kind: "visits", label: "Visits" },
  { kind: "vouchers", label: "Vouchers" },
  { kind: "gifts", label: "Gifts" },
];

/** The tab a /me/tickets address shows: bare is Visits, refunds is
 *  Vouchers (MESITA-3893). */
function ticketTabOf(seg: string | undefined): TicketTab {
  if (seg === "vouchers" || seg === "refunds") return "vouchers";
  if (seg === "gifts") return "gifts";
  return "visits";
}

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
/** Reservations' two halves (MESITA-3888, Pato: "Reservation divide by
 *  Upcoming and Past, two subpages"): /me/reservations is Upcoming,
 *  /me/reservations/past is Past. */
type ReservationHalf = "upcoming" | "past";

const RESERVATION_TABS: ReadonlyArray<{
  kind: ReservationHalf;
  label: string;
}> = [
  { kind: "upcoming", label: "Upcoming" },
  { kind: "past", label: "Past" },
];

/** Each half's empty words: an empty Past is a fact, not an invitation to
 *  book; an empty Upcoming keeps "Find a place" (MESITA-3889: it read "No
 *  reservations yet" beside four past ones). */
const EMPTY_HALF: Record<
  ReservationHalf,
  { title: string; text: string; action?: { label: string; href: string } }
> = {
  upcoming: {
    title: "No upcoming reservations",
    text: "Book a table from any place's page and it lands here.",
    action: { label: "Find a place", href: CONSUMER_ROUTES.home },
  },
  past: {
    title: "No past reservations",
    text: "A table you had or cancelled lands here.",
  },
};

export function ReservationsPage() {
  const reservations = useReservations();
  // THE CHIP IS THE PATH, as Tickets' is (MESITA-3811).
  const pathname = usePathname() ?? CONSUMER_ROUTES.mePages.reservations;
  const half: ReservationHalf = pathname.endsWith("/past")
    ? "past"
    : "upcoming";
  const halves = useMemo(
    () => (reservations.rows ? ordered(reservations.rows) : null),
    [reservations.rows],
  );
  const pick = (k: ReservationHalf) =>
    window.history.replaceState(
      null,
      "",
      k === "past"
        ? `${CONSUMER_ROUTES.mePages.reservations}/past`
        : CONSUMER_ROUTES.mePages.reservations,
    );
  // HOME'S STRIP (MESITA-3889, Pato: "the upcoming and past must have the
  // same format as the places and social menu from catalog, blue underline
  // btw"): two equal tabs edge to edge under the header, white with a
  // hairline, the chosen one bold over a full-width BLUE bar (the family
  // column's blue-600; Home's own bar stays ink, MESITA-3687). No intro card
  // ("don't mention that stupid description").
  return (
    <Screen title="Reservations">
      <div className="flex flex-col gap-4">
        <SubpageTabs
          label="Upcoming or past reservations"
          tabs={RESERVATION_TABS}
          on={half}
          onPick={pick}
        />
        <TicketList
          type="reservations"
          rows={halves ? halves[half] : null}
          ready={!reservations.loading}
          failed={!!reservations.error}
          retry={reservations.reload}
          note={null}
          foot={null}
          empty={EMPTY_HALF[half]}
        />
      </div>
    </Screen>
  );
}

/** The guest's visits, the read Tickets lists and Me's Tickets box reads
 *  for an open bill (MESITA-3885); one key, so either warms the other. */
export function useVisits() {
  const getSupabase = useLazyBrowserSupabase();
  return useCachedQuery("activity-visits", () => apiListVisits(getSupabase()), {
    ttl: TTL,
  });
}

/** /me/tickets and /me/tickets/<kind>: every transaction, one chip per kind. */
export function TicketsPage() {
  // THE TAB IS THE PATH (as Activity's chip was, MESITA-3811):
  // /me/tickets is Visits, /me/tickets/<kind> the others (MESITA-3893). The
  // kind page turns unknown names away.
  const pathname = usePathname() ?? CONSUMER_ROUTES.mePages.tickets;
  const kind = ticketTabOf(pathname.split("/")[3]);
  const getSupabase = useLazyBrowserSupabase();

  // The keys Activity used, so CreditEntry's read stays shared.
  const wallet = useCachedQuery<Wallet>(
    WALLET_CACHE_KEY,
    () => apiGetWallet(getSupabase()),
    { ttl: TTL },
  );
  const visits = useVisits();
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
      // Refunds sit with Vouchers (MESITA-3893).
      vouchers: moneyRows
        ? moneyRows.filter((r) => r.type === "vouchers" || r.type === "refunds")
        : null,
      gifts: of("gifts"),
    } satisfies Record<TicketTab, Row[] | null>;
  }, [visits.data, wallet.data]);

  const walletReady = !wallet.loading;
  // Visits waits for the wallet too, so its payments never pop in late.
  const ready =
    kind === "visits" ? !visits.loading && walletReady : walletReady;
  const failed = kind === "visits" ? !!visits.error : !!wallet.error;
  const retry = () => {
    if (visits.error) visits.reload();
    if (wallet.error) wallet.reload();
  };

  // The visits read is capped: say so under the list, not as a "+" alone.
  const shown = byKind.visits?.length ?? 0;
  const foot =
    kind === "visits" && visits.data?.truncated && shown > 0
      ? `Showing your latest ${shown} visits.`
      : null;

  const note =
    kind === "visits" && !!wallet.error
      ? "Couldn't load your payments. Visits shows your tables only."
      : null;

  // A tab tap rewrites the address in place: no navigation, so no loading
  // frame between tabs; Next keeps usePathname in step (MESITA-3811).
  const pick = (k: TicketTab) =>
    window.history.replaceState(
      null,
      "",
      k === "visits" ? ticketsHref() : ticketsHref(k),
    );

  // RESERVATIONS' STRIP (MESITA-3893, Pato: "This page must be similar to
  // reservations header with blue subpages navbar"): no counts, no intro.
  return (
    <Screen title="Tickets">
      <div className="flex flex-col gap-4">
        <SubpageTabs
          label="Kinds of ticket"
          tabs={TICKET_TABS}
          on={kind}
          onPick={pick}
        />
        <TicketList
          type={kind}
          rows={byKind[kind]}
          ready={ready}
          failed={failed}
          retry={retry}
          note={note}
          foot={foot}
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
  foot,
  empty,
}: {
  type: ListType | "all";
  rows: Row[] | null;
  ready: boolean;
  failed: boolean;
  retry: () => void;
  note: string | null;
  foot: string | null;
  /** Words for an empty list other than the type's own (Reservations'
   *  halves, MESITA-3888/3889). */
  empty?: {
    title: string;
    text: string;
    action?: { label: string; href: string };
  };
}) {
  // The clock "Today" and "Yesterday" are judged by: read once.
  const [nowMs] = useState(() => Date.now());
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
    return empty ? (
      <EmptyState
        icon={Icon}
        title={empty.title}
        description={empty.text}
        action={empty.action}
      />
    ) : (
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
  const lead = note ? (
    <p className="text-muted-foreground mb-3 text-xs">{note}</p>
  ) : null;

  // RESERVATIONS: Upcoming, then Past. One group, no heading (MESITA-3778): a
  // lone "Past" or "Upcoming" only repeated what every row said.
  if (type === "reservations") {
    return (
      <div>
        {lead}
        {upcoming.length > 0 && past.length > 0 ? (
          <>
            {group("Upcoming", upcoming, true)}
            {group("Past", past, false)}
          </>
        ) : (
          group(null, upcoming.length > 0 ? upcoming : past, true)
        )}
      </div>
    );
  }

  // TICKETS (MESITA-3865): a bill still open is not "upcoming", it is now, so
  // it leads in its own card with its button; everything else sits under the
  // day it happened, newest day first.
  const days: Array<{ title: string; list: Row[] }> = [];
  for (const r of past) {
    const title = r.at ? dayTitle(r.at, nowMs) : "Earlier";
    const last = days[days.length - 1];
    if (last && last.title === title) last.list.push(r);
    else days.push({ title, list: [r] });
  }
  return (
    <div>
      {lead}
      {group("Open now", upcoming, true)}
      {days.map((d, i) => (
        <div key={d.title}>
          {group(d.title, d.list, i === 0 && upcoming.length === 0)}
        </div>
      ))}
      {foot ? (
        <p className="text-muted-foreground mt-4 text-center text-sm">{foot}</p>
      ) : null}
    </div>
  );
}

/** A list page's subpages (MESITA-3889/3893): Home's Places | Social strip,
 *  equal tabs edge to edge under the header, white with a hairline, the
 *  chosen one bold over a full-width blue-600 bar (Pato: "blue subpages
 *  navbar"). `on` null draws no bar (the loading frame). */
function SubpageTabs<K extends string>({
  label,
  tabs,
  on,
  onPick,
}: {
  label: string;
  tabs: ReadonlyArray<{ kind: K; label: string }>;
  on: K | null;
  onPick?: (k: K) => void;
}) {
  return (
    <nav
      aria-label={label}
      className="border-border bg-card -mx-5 -mt-5 flex shrink-0 border-b"
      data-subpage-tabs
    >
      {tabs.map((t) => {
        const chosen = on === t.kind;
        return (
          <button
            key={t.kind}
            type="button"
            aria-current={chosen ? "page" : undefined}
            onClick={onPick ? () => onPick(t.kind) : undefined}
            disabled={!onPick}
            className={cn(
              "relative flex-1 px-1 py-3 text-center text-sm whitespace-nowrap transition",
              chosen
                ? "text-foreground font-semibold"
                : "text-muted-foreground",
            )}
          >
            {chosen ? (
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600"
              />
            ) : null}
            {t.label}
          </button>
        );
      })}
    </nav>
  );
}

// ─── The loading frames (MESITA-2701) ──────────────────────────────────────

/** A list page's frame while its read is out: the title in place, the
 *  list in bones; Reservations and Tickets also draw their tab strip, its
 *  words in place and no tab chosen (MESITA-3893). */
export function MeListSkeleton({
  title,
  tabs,
}: {
  title: string;
  tabs?: "reservations" | "tickets";
}) {
  return (
    <Screen title={title}>
      <div className="flex flex-col gap-4">
        {tabs ? (
          <SubpageTabs
            label={title}
            tabs={tabs === "tickets" ? TICKET_TABS : RESERVATION_TABS}
            on={null}
          />
        ) : null}
        <ActivityRowsSkeleton />
        <p role="status" className="sr-only">
          Loading {title.toLowerCase()}
        </p>
      </div>
    </Screen>
  );
}
