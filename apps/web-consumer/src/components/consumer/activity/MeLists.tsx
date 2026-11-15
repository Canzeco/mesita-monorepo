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

import { useEffect, useMemo, useRef, useState } from "react";
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
import { MeScreen } from "@/components/consumer/me/MeScreen";
import { NotificationsList } from "@/components/consumer/NotificationsClient";
import { EmptyState } from "@/components/shared/EmptyState";
import { GiftTickets } from "./GiftTickets";
import { cn } from "@/lib/utils";
import {
  apiListReservations,
  RESERVATIONS_KEY,
  type EFReservationRow,
} from "@/lib/api/reservations";
import { apiListVisits } from "@/lib/api/tab";
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
const DAY_MS = 86_400_000;

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
      kind: "reservation",
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
type TicketTab = "visits" | "vouchers" | "gifts" | "refunds";
// AN ICON ON EACH (MESITA-3900, Pato: "add icons to the top menu here"):
// the ones the page's empty states already wear. Gifts became Gifts-In and
// Gifts-Out (MESITA-3941), hyphenated (MESITA-3949, Pato: "use \"-\""), and
// one Gifts again (MESITA-4036).
const TICKET_TABS: ReadonlyArray<{
  kind: TicketTab;
  label: string;
  icon: LucideIcon;
}> = [
  { kind: "visits", label: "Visits", icon: UtensilsCrossed },
  { kind: "vouchers", label: "Vouchers", icon: BadgeDollarSign },
  { kind: "gifts", label: "Gifts", icon: Gift },
  { kind: "refunds", label: "Refunds", icon: HandCoins },
];

/** The tab a /me/tickets address shows: bare is Visits. */
function ticketTabOf(seg: string | undefined): TicketTab {
  if (seg === "vouchers") return "vouchers";
  if (seg === "refunds") return "refunds";
  if (seg === "gifts" || seg === "gifts-in" || seg === "gifts-out")
    return "gifts";
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
    <MeScreen title="Notifications">
      <div className="flex flex-col gap-4">
        {nextUp ? (
          <ActivityRows>
            <ActivityRow t={{ ...nextUp, label: "Next up" }} />
          </ActivityRows>
        ) : null}
        <NotificationsList quietEmpty={!!nextUp} />
      </div>
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
    <MeScreen
      title="Reservations"
      // NO CALENDAR MARKS UP HERE (MESITA-4042, Pato: "remove the ugly ass
      // icons of those calendars at the top right"); MESITA-3954 had put a
      // button to Integrations › Calendar here. Me › Integrations keeps it.
    >
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
      visits: visits.data
        ? [
            ...visitRows(visits.data.visits, facts),
            ...payments.filter(
              (r) => !(r.paymentId && visitIds.has(r.paymentId)),
            ),
          ]
        : null,
      vouchers: of("vouchers"),
      refunds: of("refunds"),
    } satisfies Record<Exclude<TicketTab, "gifts">, Row[] | null>;
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

  // A SCROLLING ROW OF ICON PILLS (MESITA-3993, Pato: "make a horizontal
  // scroll menu with icons"; option A of the board): Reservations' blue
  // strip (MESITA-3893) squeezed five tabs into a phone. No counts, no intro.
  return (
    <MeScreen title="Tickets">
      <div className="flex flex-col gap-4">
        <TicketPills on={kind} onPick={pick} />
        {kind === "gifts" && ready && !failed && wallet.data ? (
          <GiftTickets gifts={wallet.data.gifts ?? []} />
        ) : (
          <TicketList
            type={kind}
            rows={kind === "gifts" ? null : byKind[kind]}
            ready={ready}
            failed={failed}
            retry={retry}
            note={note}
            foot={foot}
          />
        )}
      </div>
    </MeScreen>
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
    action?: { label: string; href: string };
  };
}) {
  const Icon = ICON[type];
  if (!ready) return <ActivityRowsSkeleton />;
  if (failed || !rows) {
    return (
      <EmptyState
        icon={Icon}
        title={`Couldn't load your ${type === "all" ? "tickets" : type.replace("-", " ")}`}
        description="Check your connection and try again."
        action={{ label: "Try again", onClick: retry }}
      />
    );
  }
  if (rows.length === 0) {
    return empty ? (
      <EmptyState icon={Icon} title={empty.title} action={empty.action} />
    ) : (
      <EmptyState
        icon={Icon}
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
        <ActivityRows>
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
    <p className="text-muted-foreground mb-3 text-xs">{note}</p>
  ) : null;

  // ONE FLAT LIST (MESITA-4000, Pato: "why the fuck you separate tickets
  // by dates … just a list"): no Upcoming/Past or day headings. Reservations
  // run upcoming soonest first, then past newest first, in one list.
  if (type === "reservations") {
    return (
      <div>
        {lead}
        {group(null, [...upcoming, ...past], true)}
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
      {group(null, past, upcoming.length === 0)}
      {foot ? (
        <p className="text-muted-foreground mt-4 text-center text-sm">{foot}</p>
      ) : null}
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
              // Home's strip, size for size (MESITA-4047 after MESITA-4046):
              // 16px, the chosen word bold ink, the rest regular grey.
              "flex flex-1 justify-center px-1 text-base whitespace-nowrap transition",
              chosen ? "text-foreground font-bold" : "text-muted-foreground",
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

/** Tickets' kinds as a row of pills that scrolls sideways (MESITA-3993):
 *  A full-width hairline under the row divides it from the list (MESITA-4049,
 *  Pato: "PUT A LINE DIVIDING CAROUSEL MENU FROM EVENTS").
 *  icon and word on each, the chosen one solid ink, the rest white with a
 *  hairline. It runs to the screen's edges so the last pill peeks in and
 *  says the row scrolls; a pick slides its pill into view. `on` null is the
 *  loading frame: words in place, none chosen. */
function TicketPills({
  on,
  onPick,
}: {
  on: TicketTab | null;
  onPick?: (k: TicketTab) => void;
}) {
  const rail = useRef<HTMLElement>(null);
  useEffect(() => {
    const pill = rail.current?.querySelector<HTMLElement>("[aria-current]");
    pill?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [on]);
  return (
    <nav
      ref={rail}
      aria-label="Kinds of ticket"
      className="scrollbar-hide border-border -mx-5 flex shrink-0 scroll-px-5 flex-nowrap gap-2 overflow-x-auto overscroll-x-contain border-b px-5 pb-4"
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
              "flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm whitespace-nowrap transition",
              chosen
                ? "border-foreground bg-foreground text-background font-semibold"
                : "border-border bg-card text-foreground/80 hover:bg-muted/40 font-medium",
            )}
          >
            <t.icon
              className="h-4 w-4 shrink-0"
              strokeWidth={chosen ? 2.25 : 2}
              aria-hidden
            />
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
    <MeScreen title={title}>
      <div className="flex flex-col gap-4">
        {tabs === "tickets" ? (
          <TicketPills on={null} />
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
