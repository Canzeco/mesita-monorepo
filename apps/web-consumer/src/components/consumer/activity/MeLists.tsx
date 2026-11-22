"use client";

// ME'S THREE LISTS (Pato, 2026-11-14, MESITA-3855: "We are going to remove
// Activity too … Notifications, Reservations … Tickets includes the list of
// all the transactions: there are 4 types of tickets"). They were the bar's
// Activity tab and its chips (MESITA-3631, MESITA-3697, MESITA-3769) until
// Activity left the bar; each is a page under Me now, wearing Screen:
//
//   /me/notifications   events: NotificationsList, one size of row; the
//                       big "Next up" ticket above it left in MESITA-4053
//                       (a booking row's View opens the reservation)
//   /me/reservations    Upcoming, then Past
//   /me/tickets         every ticket under the day it happened, newest
//                       first; a waiter's bill still open sits above them in
//                       its own "Open now" card with its button (MESITA-3865).
//                       A ticket is money that moved (MESITA-3997): a bill
//                       cancelled or expired is never one, and the guest's
//                       own bill waiting for its signature lives on Pay. The
//                       chips All · Visits · Vouchers · Gifts are always
//                       there (MESITA-3882), Refunds once it holds one; a
//                       chip narrows the list, /me/tickets/<kind>:
//     Visits    the guest's tabs (consumer-web-list-visits) AND the
//               payments. A payment that paid a tab is written on that
//               Visit's card (one meal, one ticket); any other payment is
//               its own ticket
//     Vouchers  credits bought, bonuses, Story vouchers waiting
//     Gifts     every gift sent or received, sender → receiver
//               (GiftTickets, MESITA-4036; Gifts-In and Gifts-Out before)
//     Refunds   purchases refunded; its own tab again since MESITA-3949
//
// Every source loads on mount and fails on its own; a chip's count shows only
// once its sources answered. Nothing here computes a balance: it lists and
// formats what the server sent.

import { useEffect, useMemo, useState } from "react";
import { PANEL_CLASS } from "@/components/shared/Panel";
import { usePathname } from "next/navigation";
import {
  BadgeDollarSign,
  CalendarCheck,
  CalendarDays,
  Gift,
  HandCoins,
  Ticket,
  UtensilsCrossed,
  type LucideIcon,
  TriangleAlert,
  ChevronRight,
} from "lucide-react";
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { HEADER_BUTTON_CLASS } from "@/components/consumer/nav/Screen";
import { PushLink } from "@/components/consumer/nav/PushLink";
import { NotificationsList } from "@/components/consumer/NotificationsClient";
import { EmptyState } from "@/components/shared/EmptyState";
import { GiftTickets } from "./GiftTickets";
import { cn } from "@/lib/utils";
import {
  apiListReservations,
  RESERVATIONS_KEY,
  type EFReservationRow,
} from "@/lib/api/reservations";
import { apiListVisits, type GuestVisit } from "@/lib/api/tab";
import { apiGetWallet, WALLET_CACHE_KEY, type Wallet } from "@/lib/api/wallet";
import {
  CONSUMER_ROUTES,
  reservationPath,
} from "@/lib/consumer-route-contract";
import { ticketsHref, type TicketKind } from "@/lib/ticket-kinds";
import { reportError } from "@/lib/report-error";
import { stateMeta } from "@/lib/reservation-state";
import { toReservationItem } from "@/lib/reservations-adapter";
import { useLazyBrowserSupabase } from "@/lib/supabase/browser";
import { useCachedQuery } from "@/lib/use-cached-query";
import {
  join,
  visitRows,
  walletRows,
  type ListType,
  type Row,
} from "@/lib/ticket-rows";
import {
  ActivityRow,
  ActivityRows,
  ActivityRowsSkeleton,
  type StatusTone,
} from "./ActivityRow";

/** Each reservations read brings at most this many (the EF's cap). */
const RESERVATIONS_PAGE = 100;
const TTL = 2 * 60 * 1000;

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
    // PASSED, SAID LIKE CANCELLED (MESITA-4125, Pato: "if the bill already
    // passed instead of cancelled say passed, but use the same outside ticket
    // design as with cancelled"): a reservation whose time is gone reads
    // "Passed" in grey with the dimmed photo and name, whether the server
    // already marked it passed or it was still live when its time came.
    const passed = item.state === "passed" || (live && !upcoming);
    const label = passed ? "Passed" : stateMeta(item.state).label;
    const tone: StatusTone = passed
      ? "grey"
      : item.state === "confirmed"
        ? "green"
        : live
          ? "ink"
          : "grey";
    return {
      key: `r-${row.id}`,
      type: "reservations",
      kind: "reservation",
      at,
      upcoming,
      place: item.placeName,
      photo: item.placePhoto,
      status: { label, tone },
      big: item.when,
      line: join(
        `${item.partySize} ${item.partySize === 1 ? "person" : "people"}`,
        item.referenceCode && `#${item.referenceCode}`,
      ),
      dim: passed || item.state === "cancelled" || item.state === "failed",
      href: reservationPath(row.id),
    };
  });
}

// ─── Ordering ───────────────────────────────────────────────────────────────

/** Rows a ticket list shows at first, and adds per Load more (MESITA-4595). */
const PAGE = 10;

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
  { title: string; action?: { label: string; href: string } }
> = {
  reservations: {
    title: "No reservations yet",
    action: { label: "Find a place", href: CONSUMER_ROUTES.home },
  },
  all: {
    title: "No tickets yet",
    action: { label: "Pay", href: CONSUMER_ROUTES.pay },
  },
  visits: {
    title: "No visits yet",
    action: { label: "Pay", href: CONSUMER_ROUTES.pay },
  },
  vouchers: {
    title: "No vouchers yet",
    action: { label: "Find a place", href: CONSUMER_ROUTES.search },
  },
  // One Gifts list (MESITA-4036); GiftTickets draws its own empty state.
  gifts: {
    title: "No gifts yet",
    action: { label: "Send Gift", href: CONSUMER_ROUTES.mePages.gift },
  },
  // Refunds' words since MESITA-3771, kept (MESITA-3782).
  refunds: {
    title: "No refunds",
  },
};

/** Tickets' tabs (MESITA-3893, Pato: "remove all. just Visits. Vouchers.
 *  Gifts"). REFUNDS IS ITS OWN TAB AGAIN (MESITA-3949, Pato: "add Refunds
 *  here ... Refunds is important in tickets"), last. */
export type TicketTab = "visits" | "vouchers" | "gifts";
// REFUNDS LEFT FOR SETTINGS (MESITA-4402): /me/settings/refunds, RefundsPage.
// AN ICON ON EACH (MESITA-3900, Pato: "add icons to the top menu here"):
// the ones the page's empty states already wear. Gifts became Gifts-In and
// Gifts-Out (MESITA-3941), hyphenated (MESITA-3949, Pato: "use \"-\""), and
// one Gifts again (MESITA-4036).
const TICKET_TABS: ReadonlyArray<{
  kind: TicketTab;
  label: string;
  icon: LucideIcon;
}> = [
  // VOUCHERS · VISITS · GIFTS · STORIES (Pato, 2026-11-21, MESITA-4623:
  // "Vouchers Visits Gifts Stories YES THAT ORDER", the card page and this
  // feed alike). Bare /me/tickets still opens Visits: every link names it.
  { kind: "vouchers", label: "Vouchers", icon: BadgeDollarSign },
  { kind: "visits", label: "Visits", icon: UtensilsCrossed },
  { kind: "gifts", label: "Gifts", icon: Gift },
  // NO STORIES TAB (MESITA-4627): a Story voucher is a Vouchers row.
];

/** The tab a /me/tickets address shows: bare is Visits. */
function ticketTabOf(seg: string | undefined): TicketTab {
  if (seg === "vouchers") return "vouchers";
  if (seg === "gifts" || seg === "gifts-in" || seg === "gifts-out")
    return "gifts";
  // /me/tickets/stories forwards to Vouchers (MESITA-4627).
  if (seg === "stories") return "vouchers";
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

/** Full width, a hairline between rows, no box (Tickets MESITA-4595,
 *  Reservations MESITA-4608): the panels a list draws lose their radius and
 *  side and top borders, keeping the hairline under each. */
const FLUSH_ROWS =
  "[&_[data-activity]]:rounded-none [&_[data-activity]]:border-x-0 [&_[data-activity]]:border-t-0 [&_section[aria-label]]:rounded-none [&_section[aria-label]]:border-x-0 [&_section[aria-label]]:border-t-0 [&_[aria-busy]]:rounded-none [&_[aria-busy]]:border-x-0 [&_[aria-busy]]:border-t-0";

/** /me/notifications: what Mesita told you, every row one size (MESITA-4053,
 *  Pato 2026-11-15: "don't put a normal notification like that big one …
 *  keep standard size notifications with view button"). The "Next up"
 *  reservation card that led the page stays on Reservations only. */
export function NotificationsPage() {
  return (
    // FLUSH (MESITA-4607): the rows run edge to edge, no page margin, no box.
    <MeScreen title="Notifications" flush>
      <NotificationsList />
    </MeScreen>
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
  { title: string; action?: { label: string; href: string } }
> = {
  upcoming: {
    title: "No upcoming reservations",
    action: { label: "Find a place", href: CONSUMER_ROUTES.home },
  },
  past: {
    title: "No past reservations",
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
    // FLUSH (Pato, 2026-11-21, MESITA-4608: "i don't want a reservations
    // tickets inside a box. just a line dividing"): no page margin, no box.
    <MeScreen
      title="Reservations"
      flush
      // A CALENDAR SHORTCUT, TOP RIGHT (MESITA-4330, Pato: "top right, add
      // shortcut to go to calendar"): Back's white square with one plain
      // ink calendar icon, opening Me › Integrations › Calendar. Never the
      // three colour calendar marks (MESITA-4042, Pato: "remove the ugly
      // ass icons of those calendars at the top right").
      action={
        <PushLink
          href={CONSUMER_ROUTES.mePages.integrationsCalendar}
          aria-label="Calendar"
          className={HEADER_BUTTON_CLASS}
        >
          <CalendarDays className="h-5 w-5" strokeWidth={2} aria-hidden />
        </PushLink>
      }
    >
      <div className={cn("flex min-h-0 flex-1 flex-col", FLUSH_ROWS)}>
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
          edge
          empty={EMPTY_HALF[half]}
        />
      </div>
    </MeScreen>
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

/** /me/settings/refunds (MESITA-4402): the refund rows Tickets' Refunds tab
 *  listed, now a Settings page. */
export function RefundsPage() {
  const getSupabase = useLazyBrowserSupabase();
  const wallet = useCachedQuery<Wallet>(
    WALLET_CACHE_KEY,
    () => apiGetWallet(getSupabase()),
    { ttl: TTL },
  );
  useEffect(() => {
    if (wallet.error) reportError("me refunds wallet failed", wallet.error);
  }, [wallet.error]);
  const rows = useMemo(
    () =>
      wallet.data
        ? walletRows(wallet.data).filter((r) => r.type === "refunds")
        : null,
    [wallet.data],
  );
  return (
    <MeScreen title="Refunds">
      <TicketList
        type="refunds"
        rows={rows}
        ready={!wallet.loading}
        failed={!!wallet.error}
        retry={() => wallet.reload()}
        note={null}
      />
    </MeScreen>
  );
}

/** /me/tickets and /me/tickets/<kind>: every transaction, one chip per kind. */
export function TicketsPage() {
  // THE TAB IS THE PATH (as Activity's chip was, MESITA-3811):
  // /me/tickets is Visits, /me/tickets/<kind> the others (MESITA-3893). The
  // kind page turns unknown names away.
  const pathname = usePathname() ?? CONSUMER_ROUTES.mePages.tickets;
  const kind = ticketTabOf(pathname.split("/")[3]);
  // A tab tap rewrites the address in place: no navigation, so no loading
  // frame between tabs; Next keeps usePathname in step (MESITA-3811).
  const pick = (k: TicketTab) =>
    window.history.replaceState(
      null,
      "",
      k === "visits" ? ticketsHref() : ticketsHref(k),
    );
  // EDGE TO EDGE, THE STRIP FIXED (Pato, 2026-11-21, MESITA-4595: "when
  // scrolling, keep menu 4 options fixed … don't put margins nor broders on
  // tickets. just a line sepaaraitng each ticket"): no page padding; the
  // board pins its strip and runs its rows full width.
  return (
    <MeScreen title="Tickets" flush>
      <TicketsBoard kind={kind} onPick={pick} />
    </MeScreen>
  );
}

/** ONE PLACE'S TICKETS (MESITA-4279, Pato over the Loyalty Card page:
 *  "a scoped version of the notifications+tickets page but for that place";
 *  option A): Me › Tickets' pills and rows, read the same way, with every
 *  source filtered to `placeId` when one is given. The caller owns the
 *  chosen kind: Me › Tickets keeps it in the address, the card page in
 *  local state. `flush` runs the pills to MeScreen's edges. */
export function TicketsBoard({
  kind,
  onPick,
  placeId = null,
  flush = true,
  boxed = false,
  onChanged,
}: {
  kind: TicketTab;
  onPick: (k: TicketTab) => void;
  placeId?: string | null;
  flush?: boolean;
  /** The strip and its list in one white box, the inner list box flattened
   *  (MESITA-4353: the Loyalty Card page's bottom box). */
  boxed?: boolean;
  /** The host's own read again, after a Take back from a Gifts row. */
  onChanged?: () => void;
}) {
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

  // The place's slice of each read (MESITA-4279); everything when no place.
  const walletData = useMemo<Wallet | null>(() => {
    const w = wallet.data;
    if (!w || !placeId) return w ?? null;
    return {
      ...w,
      balances: w.balances.filter((b) => b.place_id === placeId),
      gifts: (w.gifts ?? []).filter((g) => g.place_id === placeId),
      stories: (w.stories ?? []).filter((st) => st.place_id === placeId),
    };
  }, [wallet.data, placeId]);
  // OLDER VISITS, ON ASK (MESITA-4595): the read holds the newest 50; Load
  // more fetches the next 50 before the oldest one held. The pages belong
  // to the read they followed: a fresh read starts them over.
  const [older, setOlder] = useState<{
    base: typeof visits.data;
    visits: GuestVisit[];
    truncated: boolean;
  } | null>(null);
  const [fetchingOlder, setFetchingOlder] = useState(false);
  const olderPages = older && older.base === visits.data ? older : null;
  const allVisits = useMemo(
    () => (visits.data ? [...visits.data.visits, ...(olderPages?.visits ?? [])] : null),
    [visits.data, olderPages],
  );
  const moreVisits = olderPages ? olderPages.truncated : !!visits.data?.truncated;
  // While older visits are unread, nothing older than the oldest held shows,
  // so a fetched page never lands among rows already on screen.
  const visitCutoff =
    moreVisits && allVisits && allVisits.length > 0
      ? Math.min(...allVisits.map((v) => Date.parse(v.created_at)))
      : null;
  const fetchOlder = () => {
    const base = visits.data;
    if (!base || !allVisits || fetchingOlder || !moreVisits || visitCutoff === null) return;
    setFetchingOlder(true);
    void apiListVisits(getSupabase(), new Date(visitCutoff).toISOString())
      .then((r) =>
        setOlder({ base, visits: [...(olderPages?.visits ?? []), ...r.visits], truncated: r.truncated }),
      )
      .catch((e: unknown) => reportError("me tickets older visits failed", e))
      .finally(() => setFetchingOlder(false));
  };
  const visitList = useMemo(
    () =>
      allVisits
        ? placeId
          ? allVisits.filter((v) => v.place.id === placeId)
          : allVisits
        : null,
    [allVisits, placeId],
  );

  const byKind = useMemo(() => {
    const visitIds = new Set(
      (visitList ?? []).flatMap((v) => v.part_payment_ids),
    );
    const moneyRows = walletData ? walletRows(walletData) : null;
    const payments = moneyRows
      ? moneyRows.filter((r) => r.type === "visits")
      : [];
    const facts = new Map(
      payments.flatMap((r) =>
        r.paymentId && r.payFacts ? [[r.paymentId, r.payFacts] as const] : [],
      ),
    );
    const of = (k: TicketKind) =>
      moneyRows ? moneyRows.filter((r) => r.type === k) : null;
    return {
      // One meal, one ticket: a payment that paid a tab is written on its
      // Visit; every other payment is a ticket of its own beside them.
      visits: visitList
        ? [
            ...visitRows(visitList, facts),
            ...payments.filter(
              (r) =>
                !(r.paymentId && visitIds.has(r.paymentId)) &&
                (visitCutoff === null || !r.at || Date.parse(r.at) >= visitCutoff),
            ),
          ]
        : null,
      vouchers: of("vouchers"),
    } satisfies Record<Exclude<TicketTab, "gifts">, Row[] | null>;
  }, [visitList, walletData, visitCutoff]);

  // PENDING TICKETS (MESITA-4623): bills waiting for the waiter, Stories
  // waiting for their check. Their tab wears a yellow dot; the card page
  // also says so in a yellow line above the tabs.
  const pending: Partial<Record<TicketTab, number>> = {
    visits: (byKind.visits ?? []).filter((r) => r.pending).length,
    vouchers: (byKind.vouchers ?? []).filter((r) => r.landing).length,
  };
  const pendingTotal = (pending.visits ?? 0) + (pending.vouchers ?? 0);
  const pendingTab: TicketTab | null = pending.visits
    ? "visits"
    : pending.vouchers
      ? "vouchers"
      : null;

  const walletReady = !wallet.loading;
  // Visits waits for the wallet too, so its payments never pop in late.
  const ready =
    kind === "visits" ? !visits.loading && walletReady : walletReady;
  const failed = kind === "visits" ? !!visits.error : !!wallet.error;
  const retry = () => {
    if (visits.error) visits.reload();
    if (wallet.error) wallet.reload();
  };

  // No "Showing your latest N" line any more (MESITA-4595): Load more.

  const note =
    kind === "visits" && !!wallet.error
      ? "Couldn't load your payments. Visits shows your tables only."
      : null;

  // THE PLACE PROFILE'S STRIP (MESITA-4322; icon pills MESITA-3993 before):
  // four equal tabs, the chosen one blue. No counts, no intro.
  const edge = flush && !boxed;
  return (
    <div
      className={cn(
        "flex flex-col",
        boxed
          ? `${PANEL_CLASS} [&_[data-activity]]:rounded-none [&_[data-activity]]:border-0`
          : edge
            ? // Full width, a hairline between tickets, no box (MESITA-4595).
              FLUSH_ROWS
            : "gap-4",
      )}
    >
      {boxed && pendingTab ? (
        <button
          type="button"
          onClick={() => onPick(pendingTab)}
          className="flex w-full items-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm font-semibold text-amber-800"
          data-tickets-pending
        >
          <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2.25} aria-hidden />
          <span className="min-w-0 flex-1">
            {pendingTotal === 1 ? "1 pending ticket" : `${pendingTotal} pending tickets`}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0" aria-hidden />
        </button>
      ) : null}
      <TicketPills on={kind} onPick={onPick} flush={false} sticky={edge} pending={pending} />
      {kind === "gifts" && ready && !failed && walletData ? (
        <GiftTickets gifts={walletData.gifts ?? []} showPlace={!placeId} onChanged={() => {
            wallet.reload();
            onChanged?.();
          }} />
      ) : (
        <TicketList
          key={kind}
          type={kind}
          rows={kind === "gifts" ? null : byKind[kind]}
          ready={ready}
          failed={failed}
          retry={retry}
          note={note}
          edge={edge}
          more={
            kind === "visits" && moreVisits
              ? { busy: fetchingOlder, fetch: fetchOlder }
              : null
          }
        />
      )}
    </div>
  );
}

function TicketList({
  type,
  rows,
  ready,
  failed,
  retry,
  note,
  edge = false,
  more = null,
  empty,
}: {
  type: ListType | "all";
  rows: Row[] | null;
  ready: boolean;
  failed: boolean;
  retry: () => void;
  note: string | null;
  /** Full width under a pinned strip (Me › Tickets, MESITA-4595): the
   *  words and buttons keep the page's 20px, the rows run edge to edge. */
  edge?: boolean;
  /** Older rows the server still holds (Visits): Load more fetches them. */
  more?: { busy: boolean; fetch: () => void } | null;
  /** Words for an empty list other than the type's own (Reservations'
   *  halves, MESITA-3888/3889). */
  empty?: {
    title: string;
    action?: { label: string; href: string };
  };
}) {
  // TEN AT A TIME (Pato, 2026-11-21, MESITA-4595: "offer button to load
  // mroe … from 10 to 10 until complete"): the newest 10 past rows, then
  // Load more adds 10, fetching older visits when the held ones run out.
  const [limit, setLimit] = useState(PAGE);
  const Icon = ICON[type];
  // An edge list's words keep the page's 20px and fill the height, so the
  // empty state stays centred on a flush page (MESITA-4608).
  const pad = edge ? "flex min-h-0 flex-1 flex-col px-5 py-5" : "";
  // Edge or not, the bones carry no padding of their own: an edge list's
  // wrapper unboxes them (FLUSH_ROWS), a boxed one sits in the page margin.
  if (!ready) return <ActivityRowsSkeleton />;
  if (failed || !rows) {
    return (
      <div className={pad}>
      <EmptyState
        icon={Icon}
        title={`Couldn't load your ${type === "all" ? "tickets" : type.replace("-", " ")}`}
        description="Check your connection and try again."
        action={{ label: "Try again", onClick: retry }}
      />
      </div>
    );
  }
  if (rows.length === 0 && !more) {
    return (
      <div className={pad}>
        {empty ? (
          <EmptyState icon={Icon} title={empty.title} action={empty.action} />
        ) : (
          <EmptyState
            icon={Icon}
            title={EMPTY[type].title}
            action={EMPTY[type].action}
          />
        )}
      </div>
    );
  }
  const { upcoming, past } = ordered(rows);
  const group = (title: string | null, list: Row[], first: boolean) =>
    list.length ? (
      <section className={cn(!first && "mt-4")}>
        {/* A heading sits INSIDE the list's panel (MESITA-4071). */}
        <ActivityRows title={title ?? undefined}>
          {list.map((r) => (
            <ActivityRow
              key={r.key}
              t={
                type === "reservations"
                  ? r.key === upcoming[0]?.key
                    ? { ...r, label: "Next up" }
                    : r
                  : // A ticket ends its line with how long ago it happened
                    // (MESITA-4000), in place of the day heading it sat under.
                    { ...r, when: r.at }
              }
            />
          ))}
        </ActivityRows>
      </section>
    ) : null;
  const lead = note ? (
    <p className={cn("text-muted-foreground mb-3 text-xs", edge && "mx-5 mt-3")}>{note}</p>
  ) : null;
  // Load more lives under the list, outside it (MESITA-4595).
  const canMore = (n: number) => n > limit || !!more;
  const loadMore = (n: number) =>
    canMore(n) ? (
      <div className={cn("mt-4 flex justify-center", edge && "mb-6 px-5")}>
        <button
          type="button"
          disabled={more?.busy}
          onClick={() => {
            setLimit((l) => l + PAGE);
            if (n < limit + PAGE && more) more.fetch();
          }}
          className="border-border bg-card text-foreground h-11 w-full rounded-xl border text-sm font-semibold disabled:opacity-60"
          data-tickets-load-more
        >
          {more?.busy ? "Loading…" : "Load more"}
        </button>
      </div>
    ) : null;

  // ONE FLAT LIST (MESITA-4000, Pato: "why the fuck you separate tickets
  // by dates … just a list"): no Upcoming/Past or day headings. Reservations
  // run upcoming soonest first, then past newest first, in one list.
  if (type === "reservations") {
    return (
      <div>
        {lead}
        {group(null, [...upcoming, ...past.slice(0, limit)], true)}
        {loadMore(past.length)}
      </div>
    );
  }

  // TICKETS: a bill still open leads under "Open now" with its button
  // (MESITA-3865); everything else is one list, newest first, each row
  // ending with how long ago it happened.
  return (
    <div>
      {lead}
      {group("Open now", upcoming, true)}
      {group(null, past.slice(0, limit), upcoming.length === 0)}
      {loadMore(past.length)}
    </div>
  );
}

/** A list page's subpages (MESITA-3889/3893): Home's Places | Social strip,
 *  equal tabs edge to edge under the header, white with a hairline, the
 *  chosen one bold ink over a 3px ink line as wide as its word, Home's since
 *  MESITA-4046 (MESITA-4047; a short 32px line in MESITA-4040, a full-width
 *  blue-600 bar before, Pato: "blue subpages navbar"). `on` null draws no
 *  line (the loading frame). */
function SubpageTabs<K extends string>({
  label,
  tabs,
  on,
  onPick,
}: {
  label: string;
  tabs: ReadonlyArray<{ kind: K; label: string; icon?: LucideIcon }>;
  on: K | null;
  onPick?: (k: K) => void;
}) {
  return (
    <nav
      aria-label={label}
      className="border-border bg-card flex shrink-0 border-b"
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
              // Home's strip, size for size (MESITA-4047 after MESITA-4046):
              // 16px, every word semibold, the chosen one ink, the rest grey (MESITA-4447).
              "flex flex-1 justify-center px-1 text-base whitespace-nowrap transition",
              chosen ? "text-foreground font-semibold" : "text-muted-foreground font-semibold",
            )}
          >
            <span className="relative flex items-center gap-1.5 py-3">
              {t.icon ? (
                <t.icon
                  className="h-[18px] w-[18px] shrink-0"
                  strokeWidth={chosen ? 2.5 : 2}
                  aria-hidden
                />
              ) : null}
              {t.label}
              {chosen ? (
                <span
                  aria-hidden
                  // Home's ink line: 3px, as wide as the icon and word, on
                  // the strip's bottom hairline. Never blue.
                  className="bg-foreground absolute inset-x-0 bottom-0 h-[3px] rounded-full"
                />
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

/** Tickets' kinds as the place profile's strip (MESITA-4322, Pato: "a menu
 *  similar to the mesita profile … each item takes 25% and selected item is
 *  blue"; it was a scrolling row of icon pills, MESITA-3993): four equal
 *  tabs, a little icon and the word (icons back in MESITA-4324), white with a bottom hairline, the chosen one blue-600
 *  bold over a 3px blue-600 line, the rest muted (packages/place-profile
 *  PlaceTabBar, size for size). `on` null is the loading frame: words in
 *  place, none chosen. */
function TicketPills({
  on,
  onPick,
  flush = true,
  sticky = false,
  pending = {},
}: {
  /** Pending tickets per tab: a yellow dot on the word (MESITA-4623). */
  pending?: Partial<Record<TicketTab, number>>;
  on: TicketTab | null;
  onPick?: (k: TicketTab) => void;
  /** Runs to MeScreen's edges; false inside a card page's column. */
  flush?: boolean;
  /** Pinned to the scroller's top while the list scrolls (MESITA-4595). */
  sticky?: boolean;
}) {
  return (
    <nav
      aria-label="Kinds of ticket"
      // FOUR EQUAL COLUMNS, ONE LINE (Pato, MESITA-4414: "25% each"): Stories
      // (MESITA-4405) made it four; three columns wrapped it to a second line.
      className={cn("bg-card border-border grid shrink-0 grid-cols-3 border-b", flush && "-mx-5", sticky && "sticky top-0 z-10")}
      data-ticket-pills
    >
      {TICKET_TABS.map((t) => {
        const chosen = on === t.kind;
        return (
          <button
            key={t.kind}
            type="button"
            aria-current={chosen ? "page" : undefined}
            onClick={onPick ? () => onPick(t.kind) : undefined}
            disabled={!onPick}
            className={cn(
              "-mb-px flex min-w-0 items-center justify-center gap-1 border-b-[3px] px-0 py-3 text-center type-body leading-normal tracking-wide whitespace-nowrap transition",
              chosen
                ? "border-blue-600 font-bold text-blue-600"
                : "text-muted-foreground hover:text-foreground border-transparent font-semibold",
            )}
          >
            {/* A little icon before each word (MESITA-4324, Pato: "is ok if
                you add little icons in the four"). */}
            <t.icon className="h-4 w-4 shrink-0" strokeWidth={chosen ? 2.5 : 2} aria-hidden />
            {t.label}
            {pending[t.kind] ? (
              <span
                className={cn("h-2 w-2 shrink-0 rounded-full", t.kind === "vouchers" ? "bg-blue-500" : "bg-amber-400")}
                aria-label="pending"
                data-tab-pending
              />
            ) : null}
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
    // Tickets (MESITA-4595) and Reservations (MESITA-4608) draw edge to
    // edge, their frames too: rows full width, a hairline between them.
    <MeScreen title={title} flush={!!tabs}>
      <div className={cn("flex flex-col", tabs ? FLUSH_ROWS : "gap-4")}>
        {tabs === "tickets" ? (
          <TicketPills on={null} flush={false} />
        ) : tabs ? (
          <SubpageTabs label={title} tabs={RESERVATION_TABS} on={null} />
        ) : null}
        <ActivityRowsSkeleton />
        <p role="status" className="sr-only">
          Loading {title.toLowerCase()}
        </p>
      </div>
    </MeScreen>
  );
}
