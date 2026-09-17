"use client";

// Activity — THE LEDGER BOOK. Eight logs, and a feed over the top of them.
//
// Pato, 2026-09-16: *"activity is like the centralized passive feed of
// everything — you configure in products and then in activity you observe the
// shit. Put different tables feeds, not just the passive notification but the
// actual ticket of each: views, visits, orders, reservations, payments,
// credits, settings. Certain events might produce events in multiple logs."*
//
// WHAT THIS PAGE WAS: one flat list of one-liners, read out of a hand-authored
// `ACTIVITY` fixture that had never heard of a single visit, order or payout in
// this console. It could tell you a payout happened. It could not show you the
// payout.
//
// WHAT IT IS: `mock/logs.ts` projects every record at this place into eight
// logs, and this page renders all eight as TABLES — the ticket, with its own
// columns — under a feed that is the union of exactly those rows. The feed and
// the tables are the same data at two resolutions, so this screen has no way to
// contradict itself.
//
// THE FAN-OUT IS DRAWN, not described. A settled visit writes a Payments row
// per tender and a Credits row for what came off the bill, so the visit carries
// a "Wrote to" column and every derived row carries "From". Follow a $1,799.97
// visit down the page and you find its card tender in Payments and its credits
// in Credits, adding to that same total. Four of the eight logs fan out and
// four do not — Views, Reservations, Reviews and Settings are self-contained,
// which is what stops the fan-out reading as a rule.
//
// THE PRODUCT PAGES KEEP THEIR ACTIVITY HALF and are the full archive; each log
// here is capped and names the screen that holds the rest. Two placements, one
// source — the duplication this page used to have was two SOURCES, which is the
// only kind that can drift.
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotHeld, useHeldPlaceOrNull, usePlaceScope } from "@/components/console/PlaceScope";
import { PlaceHeading } from "@/components/console/PlaceHeading";
import { Section } from "@/components/shared/Section";
import { Tiles } from "@/components/shared/Tiles";
import { EmptyState } from "@/components/shared/EmptyState";
import { Badge } from "@/components/shared/Badges";
import { Table, type Column } from "@/components/shared/Table";
import {
  buildLedgers,
  LOG_KEYS,
  LOG_LABEL,
  SETTING_AREA_LABEL,
  type CreditLogRow,
  type LedgerBook,
  type LogKey,
  type LogRow,
  type OrderLogRow,
  type PaymentLogRow,
  type ReservationLogRow,
  type ReviewLogRow,
  type SettingLogRow,
  type ViewLogRow,
  type VisitLogRow,
} from "@/mock/logs";
import { useMock } from "@/mock/MockStore";
import { placePageHref, placePayHref } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";
import { dayTime, money, since, stars } from "@/lib/format";
import { TENDER_LABEL } from "@/lib/tender";
import { QUIET_LINK_BUTTON_CLASS, TINY_LABEL_CLASS } from "@/lib/ui-classes";

/** HOW MANY ROWS A LOG SHOWS HERE. Eight uncapped tables is ninety rows of
 *  scroll and nothing readable; this page is where you SEE that a log has
 *  something in it, and the product page is where you read all of it. */
const LOG_ROWS = 6;

/** The feed is longer than a log, because interleaving is its whole job: a
 *  dozen rows is where a booking, a visit and the payout it produced start
 *  landing in the same window. */
const FEED_ROWS = 14;

/** WHO OWNS THE FULL LOG. Null where nothing does — there is no product called
 *  Views, and a link to a screen that does not exist is worse than no link. */
const LOG_HOME: Record<LogKey, ((placeId: string) => string) | null> = {
  views: null,
  visits: (id) => placeTabHref(id, "visits"),
  orders: (id) => placeTabHref(id, "orders"),
  reservations: (id) => placeTabHref(id, "reservations"),
  reviews: (id) => placeTabHref(id, "profile"),
  payments: (id) => placePayHref(id),
  credits: (id) => placeTabHref(id, "credits"),
  settings: (id) => placePageHref(id, "settings"),
};

const LOG_HOME_LABEL: Record<LogKey, string> = {
  views: "",
  visits: "Mesita Visits",
  orders: "Mesita Orders",
  reservations: "Mesita Reservations",
  reviews: "Profile",
  payments: "Mesita Payments",
  credits: "Mesita Credits",
  settings: "this place's Settings",
};

/** WHAT WOULD PUT A ROW HERE. A log's description says what the log IS, and an
 *  empty card that repeats it back says the same sentence twice and answers
 *  the one question the reader actually has — "so what fills this?" — with
 *  nothing. */
const LOG_EMPTY_HINT: Record<LogKey, string> = {
  views: "The first row lands the moment somebody opens this place in the app. There is nothing to switch on.",
  visits: "The first row lands when a guest closes a bill here with Mesita.",
  orders: "The first row lands the moment a guest pays for a pickup or delivery order.",
  reservations: "The first row lands when your provider holds a table.",
  reviews: "The first row lands when a guest writes about this place, on Mesita or on Google.",
  payments: "Nothing has moved. Visits, orders and credit sales all write their money here.",
  credits: "Nothing minted, nothing spent. A row lands when a guest buys credit, or puts some against a bill.",
  settings: "The first row lands the next time somebody on the team changes something about this place.",
};

const LOG_DESCRIPTION: Record<LogKey, string> = {
  views:
    "Somebody looked at this place. The only log nothing has to be switched on to collect — and the only one that never writes anywhere else.",
  visits: "A bill closed at the table. Settling one writes into Payments and Credits.",
  orders: "Pickup and delivery. Prepaid, so placing one writes into Payments.",
  reservations:
    "Tables your provider is holding — soonest first, then the ones that have passed. The only log here that is not newest-first, because a bookings list leads with the next table to seat.",
  reviews: "Written on Mesita or on Google. A Google review cannot be answered from inside Mesita.",
  payments: "Every movement of money, in or out. Almost every row here was caused by something above.",
  credits: "Credit minted when a guest buys it, and spent when it comes off a bill.",
  settings: "What the house changed. The one log a guest never writes.",
};

export default function PlaceActivityPage() {
  const place = useHeldPlaceOrNull();
  const { pages } = usePlaceScope();
  const { scenario, now } = useMock();
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;
  // AND HELD AS WHAT (MESITA-1933). `NotHeld` above answers "is this place
  // held"; it has never answered the role, and until now nothing did for this
  // page — the rail's product rows were running `tabsForAccess` and that was
  // the whole console's role check. The rows are gone, so the gate is here.
  // `notFound`, like `PlaceTabGate`: a page reachable by typing its address is
  // a page, whatever the rail chose to draw.
  if (!pages.includes("activity")) notFound();

  const book = buildLedgers(place.id, scenario, now);
  const feed = book.everything;

  const moneyIn = book.payments.filter((p) => p.direction === "in");
  const moneyOut = book.payments.filter((p) => p.direction === "out");
  const sum = (rows: { amountCents: number }[]) =>
    rows.reduce((n, r) => n + r.amountCents, 0);

  return (
    <>
      <PlaceHeading place={place} view="Activity" />

      <Tiles
        tiles={[
          { label: "Events shown", value: feed.length || null },
          {
            label: "Money in",
            value: moneyIn.length ? money(sum(moneyIn)) : null,
            // IT SAYS WHAT IT COUNTED, not where the rows are. These sum the
            // WHOLE Payments log, and the table below shows six of it — so
            // "of the payments below" would have named a much smaller list
            // than the number it sits under. Naming the count is the same rule
            // every total in this console follows, applied to a log that is
            // complete for the place but capped on the page.
            // NO HINT UNDER A DASH. "Across 0 payments" beneath a value that
            // is not a number reads as a measurement of nothing.
            hint: moneyIn.length ? `Across ${moneyIn.length} payments` : undefined,
          },
          {
            label: "Money out",
            value: moneyOut.length ? money(sum(moneyOut)) : null,
            hint: moneyOut.length ? `Across ${moneyOut.length} payouts` : undefined,
          },
          { label: "Newest", value: feed[0] ? since(feed[0].at, now) : null },
        ]}
      />

      <Section
        title="Everything that happened here"
        description="Newest first, across all eight logs, up to right now. One thing a guest does can land in three of them — follow a row down to the logs and you find the pieces it wrote."
      >
        {feed.length === 0 ? (
          <EmptyState
            title="Nothing yet"
            hint="Activity starts the first time somebody looks at this place."
          />
        ) : (
          <>
            <ol className="flex flex-col">
              {feed.slice(0, FEED_ROWS).map((row) => (
                <FeedRow key={row.id} row={row} now={now} />
              ))}
            </ol>
            <Capped shown={Math.min(FEED_ROWS, feed.length)} total={feed.length} tail="Every one of them is in a log below. Bookings still ahead of now are not here — they are in Reservations." />
          </>
        )}
      </Section>

      {/* THE EIGHT COME OFF ONE ARRAY, in `LOG_KEYS`' order, so a ninth log
          cannot be added to the book and left off this page by forgetting —
          the same law `RAIL_ROWS` holds for the rail. */}
      {LOG_KEYS.map((key) => {
        // ONE CAST, and the mapped type on `LOG_SPECS` is what pays for it:
        // each entry's columns were proved against that key's own row type
        // when the record was written, and TypeScript simply cannot carry that
        // proof through a `key` that is still the union.
        const spec = LOG_SPECS[key] as { columns: Column<LogRow>[]; minWidth: number };
        return <Log key={key} log={key} book={book} placeId={place.id} {...spec} />;
      })}
    </>
  );
}

/** One log's card. Generic over the row type, so every table below declares
 *  columns against its OWN record and none of them degrade to title/detail —
 *  which is the difference between a ticket and a notification. */
function Log<K extends LogKey>({
  log,
  book,
  placeId,
  columns,
  minWidth,
}: {
  log: K;
  book: LedgerBook;
  placeId: string;
  columns: Column<LedgerBook[K][number]>[];
  minWidth: number;
}) {
  const rows = book[log] as LedgerBook[K][number][];
  const href = LOG_HOME[log]?.(placeId) ?? null;
  return (
    <Section
      title={LOG_LABEL[log]}
      description={LOG_DESCRIPTION[log]}
      right={
        href && rows.length > 0 ? (
          <Link href={href} className={QUIET_LINK_BUTTON_CLASS}>
            Open {LOG_HOME_LABEL[log]}
          </Link>
        ) : undefined
      }
    >
      <Table
        columns={columns}
        rows={rows.slice(0, LOG_ROWS)}
        minWidth={minWidth}
        empty={<EmptyState title={`No ${LOG_LABEL[log].toLowerCase()} yet`} hint={LOG_EMPTY_HINT[log]} />}
      />
      {rows.length > LOG_ROWS && (
        <Capped
          shown={LOG_ROWS}
          total={rows.length}
          tail={href ? `The rest are in ${LOG_HOME_LABEL[log]}.` : "This log has no page of its own yet."}
        />
      )}
    </Section>
  );
}

/** WHAT THIS CARD IS NOT SHOWING YOU. A truncated list that does not say it is
 *  truncated is the same failure as a total that does not say its scope. */
function Capped({ shown, total, tail }: { shown: number; total: number; tail: string }) {
  return (
    <p className="text-muted-foreground text-[11px] leading-snug">
      Latest {shown} of {total}. {tail}
    </p>
  );
}

function FeedRow({ row, now }: { row: LogRow; now: Date }) {
  return (
    <li className="border-border flex items-center gap-3 border-b py-2.5 last:border-0">
      {/* FIXED WIDTH ONLY WHERE THERE IS WIDTH TO FIX. A 96px lane makes the
          log names line up into a readable column on a wide card; on a 375px
          phone it is a quarter of the row spent on a word that is already
          short, and it truncates the titles beside it to six characters. */}
      <Badge className="shrink-0 sm:w-24 sm:justify-center">{LOG_LABEL[row.log]}</Badge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium">{row.title}</p>
        <p className="text-muted-foreground truncate text-[11px]">
          {row.detail}
          {/* THE JOIN, SAID IN THE FEED. Without it a card tender and the visit
              that produced it are two unrelated lines a minute apart. */}
          {row.origin && <span> · from {row.origin.label}</span>}
        </p>
      </div>
      {row.wroteTo.length > 0 && (
        <div className="hidden shrink-0 gap-1 sm:flex">
          {row.wroteTo.map((key) => (
            <Badge key={key} tone="off">
              {LOG_LABEL[key]}
            </Badge>
          ))}
        </div>
      )}
      {row.amountCents !== null && (
        <p className="text-[13px] font-semibold tabular-nums">{money(row.amountCents)}</p>
      )}
      <p className={`${TINY_LABEL_CLASS} w-16 shrink-0 text-right`}>{since(row.at, now)}</p>
    </li>
  );
}

// ── THE COLUMNS ─────────────────────────────────────────────────────────────
//
// `When` leads every one of them, because these are logs: the row's identity is
// the moment it happened, and eight tables that each start somewhere else make
// the page eight unrelated screens.

const when = <T extends { at: string }>(): Column<T> => ({
  key: "at",
  head: "When",
  cell: (r) => <span className="text-muted-foreground whitespace-nowrap">{dayTime(r.at)}</span>,
});

/** The consequences, as chips. Empty means this row caused nothing — printed
 *  as a dash, never as a blank cell, so "nothing" is visibly an answer. */
function WroteTo({ keys }: { keys: LogKey[] }) {
  if (keys.length === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {keys.map((key) => (
        <Badge key={key} tone="off">
          {LOG_LABEL[key]}
        </Badge>
      ))}
    </div>
  );
}

/** Where a derived row came from. A source row is its own origin, which the
 *  dash says. */
function From({ row }: { row: LogRow }) {
  if (!row.origin) return <span className="text-muted-foreground">—</span>;
  return <span className="text-muted-foreground">{row.origin.label}</span>;
}

const VIEW_COLUMNS: Column<ViewLogRow>[] = [
  when(),
  { key: "surface", head: "Surface", cell: (r) => <Badge>{r.view.surface}</Badge> },
  {
    key: "who",
    head: "Who",
    cell: (r) =>
      r.view.guest ? (
        <span className="font-medium">{r.view.guest}</span>
      ) : (
        <span className="text-muted-foreground">Signed out</span>
      ),
  },
  { key: "outcome", head: "What they did", cell: (r) => r.detail.split(" · ")[1] },
];

const VISIT_STATE_TONE = { settled: "on", open: "soon", voided: "bad" } as const;

const VISIT_COLUMNS: Column<VisitLogRow>[] = [
  when(),
  { key: "guest", head: "Guest", cell: (r) => <span className="font-medium">{r.visit.guest}</span> },
  { key: "reward", head: "Reward", align: "right", cell: (r) => (r.visit.rewardCents ? money(r.visit.rewardCents) : "—") },
  { key: "credits", head: "Credits", align: "right", cell: (r) => (r.visit.creditsCents ? money(r.visit.creditsCents) : "—") },
  {
    key: "tenders",
    head: "Paid with",
    cell: (r) =>
      r.visit.tenders.length === 0 ? (
        <span className="text-muted-foreground">—</span>
      ) : (
        <span className="text-muted-foreground text-[12px]">
          {r.visit.tenders.map((t) => TENDER_LABEL[t.method]).join(" + ")}
        </span>
      ),
  },
  { key: "total", head: "Total", align: "right", cell: (r) => <span className="font-semibold">{money(r.visit.totalCents)}</span> },
  { key: "state", head: "State", cell: (r) => <Badge tone={VISIT_STATE_TONE[r.visit.state]}>{r.visit.state}</Badge> },
  { key: "wrote", head: "Wrote to", cell: (r) => <WroteTo keys={r.wroteTo} /> },
];

const ORDER_STATE_TONE = {
  placed: "soon",
  preparing: "soon",
  ready: "on",
  collected: "on",
  canceled: "bad",
} as const;

const ORDER_COLUMNS: Column<OrderLogRow>[] = [
  when(),
  { key: "guest", head: "Guest", cell: (r) => <span className="font-medium">{r.order.guest}</span> },
  { key: "channel", head: "Channel", cell: (r) => <Badge>{r.order.channel}</Badge> },
  { key: "items", head: "Items", align: "right", cell: (r) => r.order.items },
  { key: "total", head: "Paid", align: "right", cell: (r) => <span className="font-semibold">{money(r.order.totalCents)}</span> },
  { key: "state", head: "State", cell: (r) => <Badge tone={ORDER_STATE_TONE[r.order.state]}>{r.order.state}</Badge> },
  { key: "wrote", head: "Wrote to", cell: (r) => <WroteTo keys={r.wroteTo} /> },
];

const RESERVATION_STATE_TONE = {
  requested: "soon",
  confirmed: "on",
  seated: "on",
  no_show: "bad",
  canceled: "bad",
} as const;

const RESERVATION_COLUMNS: Column<ReservationLogRow>[] = [
  when(),
  { key: "guest", head: "Guest", cell: (r) => <span className="font-medium">{r.reservation.guest}</span> },
  { key: "party", head: "Party", align: "right", cell: (r) => r.reservation.party },
  {
    key: "state",
    head: "State",
    cell: (r) => (
      <Badge tone={RESERVATION_STATE_TONE[r.reservation.state]}>
        {r.reservation.state.replace("_", " ")}
      </Badge>
    ),
  },
  {
    key: "note",
    head: "Note",
    cell: (r) =>
      r.reservation.note ? (
        <span className="text-muted-foreground">{r.reservation.note}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
];

const REVIEW_COLUMNS: Column<ReviewLogRow>[] = [
  when(),
  { key: "guest", head: "Guest", cell: (r) => <span className="font-medium">{r.review.guest}</span> },
  { key: "where", head: "Where", cell: (r) => <Badge>{r.review.source}</Badge> },
  { key: "stars", head: "Stars", cell: (r) => <span className="tracking-tight">{stars(r.review.stars)}</span> },
  {
    key: "answered",
    head: "Answered",
    // A GOOGLE ROW IS NOT "WAITING". Google's owner replies are written on
    // Google, so printing an unanswered state over one would promise a reply
    // box this console does not have.
    cell: (r) =>
      r.review.source === "google" ? (
        <span className="text-muted-foreground">Not from here</span>
      ) : r.review.reply ? (
        <Badge tone="on">Answered</Badge>
      ) : (
        <Badge tone="soon">Waiting</Badge>
      ),
  },
];

const PAYMENT_COLUMNS: Column<PaymentLogRow>[] = [
  when(),
  {
    key: "direction",
    head: "Direction",
    cell: (r) => <Badge tone={r.direction === "out" ? "off" : "on"}>{r.direction === "out" ? "Out" : "In"}</Badge>,
  },
  { key: "method", head: "Method", cell: (r) => <Badge>{r.method === "payout" ? "Bank" : TENDER_LABEL[r.method]}</Badge> },
  { key: "party", head: "Party", cell: (r) => <span className="font-medium">{r.party}</span> },
  { key: "from", head: "From", cell: (r) => <From row={r} /> },
  { key: "amount", head: "Amount", align: "right", cell: (r) => <span className="font-semibold">{money(r.amountCents)}</span> },
];

// CREDITS IS THE ONE LOG THAT RUNS BOTH WAYS, so it carries both join columns.
// A `spent` row is a consequence — it came FROM a visit. An `issued` row is a
// cause — the guest paid for it, so it WROTE a payment. One column could only
// ever show half of that, and the half it showed would depend on the row.
const CREDIT_COLUMNS: Column<CreditLogRow>[] = [
  when(),
  { key: "guest", head: "Guest", cell: (r) => <span className="font-medium">{r.guest}</span> },
  { key: "move", head: "Move", cell: (r) => <Badge tone={r.move === "issued" ? "on" : "off"}>{r.move}</Badge> },
  { key: "from", head: "From", cell: (r) => <From row={r} /> },
  { key: "wrote", head: "Wrote to", cell: (r) => <WroteTo keys={r.wroteTo} /> },
  { key: "amount", head: "Amount", align: "right", cell: (r) => <span className="font-semibold">{money(r.amountCents)}</span> },
];

const SETTING_COLUMNS: Column<SettingLogRow>[] = [
  when(),
  { key: "who", head: "Who", cell: (r) => <span className="font-medium">{r.change.who}</span> },
  { key: "area", head: "Where", cell: (r) => <Badge>{SETTING_AREA_LABEL[r.change.area]}</Badge> },
  { key: "what", head: "What", cell: (r) => r.change.what },
  {
    key: "change",
    head: "Change",
    // NULL `from` IS "THERE WAS NOTHING HERE", and an arrow out of nowhere says
    // that better than the word None, which would invent a prior value.
    cell: (r) => (
      <span className="text-muted-foreground">
        {r.change.from ? `${r.change.from} → ${r.change.to}` : `→ ${r.change.to}`}
      </span>
    ),
  },
];

/** EVERY LOG'S TABLE, keyed by the log. It is a `Record` and not eight calls
 *  in the body on purpose: a mapped type over `LogKey` refuses to compile the
 *  day a ninth log joins `LOG_KEYS` without columns, which is exactly the
 *  failure "we added a log and Activity never showed it" looks like.
 *
 *  `minWidth` is per COLUMN SET, never global — the eight-column Visits table
 *  needs 900px before it wraps a tender list into four lines, and the
 *  four-column Views table at 900 is a third empty. */
const LOG_SPECS: {
  [K in LogKey]: { columns: Column<LedgerBook[K][number]>[]; minWidth: number };
} = {
  views: { columns: VIEW_COLUMNS, minWidth: 560 },
  visits: { columns: VISIT_COLUMNS, minWidth: 900 },
  orders: { columns: ORDER_COLUMNS, minWidth: 780 },
  reservations: { columns: RESERVATION_COLUMNS, minWidth: 640 },
  reviews: { columns: REVIEW_COLUMNS, minWidth: 660 },
  payments: { columns: PAYMENT_COLUMNS, minWidth: 780 },
  credits: { columns: CREDIT_COLUMNS, minWidth: 780 },
  settings: { columns: SETTING_COLUMNS, minWidth: 740 },
};
