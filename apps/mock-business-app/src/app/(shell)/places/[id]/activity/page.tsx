"use client";

// Activity — THE LEDGER BOOK. Nine logs, one table, and a rail of types.
//
// Pato, 2026-09-16: *"activity is like the centralized passive feed of
// everything — you configure in products and then in activity you observe the
// shit. Put different tables feeds, not just the passive notification but the
// actual ticket of each: views, visits, orders, reservations, payments,
// credits, settings. Certain events might produce events in multiple logs."*
//
// `mock/logs.ts` projects every record at this place into nine logs, and this
// page renders them as TABLES — the ticket, with its own columns — plus the
// union of exactly those rows under "Everything". The union is derived from
// the logs, so this screen has no way to contradict itself.
//
// ONE TABLE AT A TIME (MESITA-1942). Pato, with the old page on screen:
// *"remove the stupid header here, just the direct list with an horizontal
// catalog of types of events to select and see the table, no more. clean
// tables."* What went:
//
//   · FOUR TILES — Events shown, Money in, Money out, Newest. Three of them
//     summed a log the page then showed six rows of, so the number and the
//     list under it were never the same thing. Money in and Money out are
//     Payments' own subject and Payments is one chip away with every row in it.
//   · EIGHT STACKED CARDS, each with a title, a sentence of description and a
//     "Latest 6 of 41" footnote. Eight capped tables is ninety rows of scroll
//     and nothing readable; the cap existed only because they were all on
//     screen at once. One selected log is uncapped — a log you asked for shows
//     what it holds.
//   · THE FEED as a list of one-liners over the top of the tables. It is the
//     "Everything" chip now, drawn as a table like everything else, because a
//     feed and a table of the same rows is the same screen twice.
//
// THE PLACE HEADING STAYS. It is the page's `h1` and every view in the console
// wears it; deleting it here alone would make Activity the one screen that
// does not say which place you are looking at.
//
// THE PRODUCT PAGES KEEP THEIR ACTIVITY HALF and are the full archive; the
// rail's right side links the selected log's home. Two placements, one source
// — the duplication this page used to have was two SOURCES, which is the only
// kind that can drift.
import { useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { NotHeld, useHeldPlaceOrNull, usePlaceScope } from "@/components/console/PlaceScope";
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
  type SubscriptionLogRow,
  type ViewLogRow,
  type VisitLogRow,
} from "@/mock/logs";
import { useMock } from "@/mock/MockStore";
import { SHELL_ROUTES, placePageHref, placePayHref } from "@/lib/console-routes";
import { placeTabHref } from "@/lib/place-tabs";
import { csvDay, csvFilename, csvMoney, csvWhen, downloadCsv, toCsv } from "@/lib/csv";
import { dayTime, money, stars } from "@/lib/format";
import { TENDER_LABEL } from "@/lib/tender";
import { GHOST_PILL_BUTTON_CLASS, PILL_BUTTON_CLASS, QUIET_LINK_BUTTON_CLASS } from "@/lib/ui-classes";
import { cn } from "@/lib/utils";

/** A COLUMN THAT CAN BE EXPORTED. `text` is required here and optional in the
 *  shared `Column`, so the export cannot silently ship a blank column on this
 *  page and no other table in the console has to grow one to compile. */
type LogColumn<T> = Column<T> & { text: (row: T) => string };

/** The rail: the union first, then the eight in `LOG_KEYS`' order, so a ninth
 *  log cannot join the book and be left off this page by forgetting — the same
 *  law `RAIL_ROWS` holds for the rail. */
const TABS = ["everything", ...LOG_KEYS] as const;
type Tab = (typeof TABS)[number];

const TAB_LABEL: Record<Tab, string> = { everything: "Everything", ...LOG_LABEL };

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
  // Both products this log bills for live on Setup: the Customers row is
  // there with the rest of the suite, and the Membership strip sits above it.
  subscriptions: (id) => placePageHref(id, "setup"),
  // SETTINGS IS NOT PLACE-SCOPED (MESITA-1973), so this door ignores the id it
  // is handed rather than building an address that no longer exists.
  settings: () => SHELL_ROUTES.settings,
};

const LOG_HOME_LABEL: Record<LogKey, string> = {
  views: "",
  visits: "Visit Rewards",
  orders: "Online Orders",
  reservations: "Reservations",
  reviews: "Profile",
  payments: "Online Payments",
  credits: "Prepaid Credits",
  // SHORT, because it rides at the end of a rail that is now nine chips wide:
  // "Open the Products catalogue" pushed the selected chip off its own row.
  subscriptions: "Products",
  settings: "this place's Settings",
};

/** WHAT WOULD PUT A ROW HERE. The chip already says which log you are looking
 *  at, so the empty state's job is the one question left — "so what fills
 *  this?" */
const TAB_EMPTY_HINT: Record<Tab, string> = {
  everything: "Activity starts the first time somebody looks at this place.",
  views: "The first row lands the moment somebody opens this place in the app. There is nothing to switch on.",
  visits: "The first row lands when a guest closes a bill here with Mesita.",
  orders: "The first row lands the moment a guest pays for a pickup or delivery order.",
  reservations: "The first row lands when your provider holds a table.",
  reviews: "The first row lands when a guest writes about this place, on Mesita or on Google.",
  payments: "Nothing has moved. Visits, orders and credit sales all write their money here.",
  credits: "Nothing minted, nothing spent. A row lands when a guest buys credit, or puts some against a bill.",
  subscriptions:
    "Nothing has ever been billed here. A partner an operator switched on by hand is never charged, and a catalog nobody subscribed to has no history — neither of those is a subscription that ended.",
  settings: "The first row lands the next time somebody on the team changes something about this place.",
};

export default function PlaceActivityPage() {
  const place = useHeldPlaceOrNull();
  const { pages } = usePlaceScope();
  const { scenario, now } = useMock();
  const [tab, setTab] = useState<Tab>("everything");
  // THE GATE THESE PAGES WERE MISSING. They are static segments beside
  // `[view]`, so no tab gate ever runs for them: a pool id typed into the bar,
  // or the scenario flipped to a failed read while one of them was open, used
  // to reach the body with no place at all. It sits after the hooks and before
  // the first `place.` — a guard below a dereference is not a guard.
  if (!place) return <NotHeld />;
  // AND HELD AS WHAT (MESITA-1933). `NotHeld` above answers "is this place
  // held"; it has never answered the role. `notFound`, like `PlaceTabGate`: a
  // page reachable by typing its address is a page, whatever the rail drew.
  if (!pages.includes("activity")) notFound();

  const book = buildLedgers(place, scenario, now);
  // ONE CAST, and the mapped type on `TAB_SPECS` is what pays for it: each
  // entry's columns were proved against that tab's own row type when the
  // record was written, and TypeScript cannot carry that proof through a `tab`
  // that is still the union.
  const spec = TAB_SPECS[tab] as {
    columns: LogColumn<LogRow>[];
    csv?: LogColumn<LogRow>[];
    minWidth: number;
  };
  const rows = book[tab] as LogRow[];
  const home = tab === "everything" ? null : LOG_HOME[tab]?.(place.id) ?? null;

  const exportCsv = () =>
    downloadCsv(
      csvFilename([place.name, TAB_LABEL[tab], csvDay(now)]),
      toCsv(spec.csv ?? spec.columns, rows),
    );

  return (
    <>
      {/* THE CATALOGUE OF TYPES. One row, horizontal, scrolling on its own
          axis below lg — nine chips do not wrap into three ragged lines, and a
          rail that wraps stops reading as one control. The count rides IN the
          chip: picking a log you can already see is empty is a click you
          should not have to spend. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="scrollbar-none -mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 py-1">
          {TABS.map((key) => {
            const on = key === tab;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                aria-pressed={on}
                className={cn(on ? PILL_BUTTON_CLASS : GHOST_PILL_BUTTON_CLASS, "shrink-0")}
              >
                {TAB_LABEL[key]}
                <span className="tabular-nums opacity-60">{(book[key] as LogRow[]).length}</span>
              </button>
            );
          })}
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {home && rows.length > 0 && (
            <Link href={home} className={QUIET_LINK_BUTTON_CLASS}>
              Open {LOG_HOME_LABEL[tab as LogKey]}
            </Link>
          )}
          {/* EXPORTS WHAT IS ON SCREEN — this log, every row of it, the columns
              you are looking at. An export button that quietly hands over a
              different shape than the table above it is worse than none. */}
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className={GHOST_PILL_BUTTON_CLASS}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      <Table
        columns={spec.columns}
        rows={rows}
        minWidth={spec.minWidth}
        empty={<EmptyState title="Nothing here yet" hint={TAB_EMPTY_HINT[tab]} />}
      />
    </>
  );
}

// ── THE COLUMNS ─────────────────────────────────────────────────────────────
//
// `When` leads every one of them, because these are logs: the row's identity is
// the moment it happened, and nine tables that each start somewhere else make
// the page nine unrelated screens.

const when = <T extends { at: string }>(): LogColumn<T> => ({
  key: "at",
  head: "When",
  cell: (r) => <span className="text-muted-foreground whitespace-nowrap">{dayTime(r.at)}</span>,
  text: (r) => csvWhen(r.at),
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

const wroteToText = (keys: LogKey[]) => keys.map((k) => LOG_LABEL[k]).join(" + ");

/** Where a derived row came from. A source row is its own origin, which the
 *  dash says. */
function From({ row }: { row: LogRow }) {
  if (!row.origin) return <span className="text-muted-foreground">—</span>;
  return <span className="text-muted-foreground">{row.origin.label}</span>;
}

/** THE UNION IS NOT A TABLE (MESITA-1947). Pato: *"the everything log must be
 *  different, just log type and detail, you cannot standarize everything in
 *  more columns, its weird"*.
 *
 *  He is describing the one difference between this column set and the nine
 *  below it. Each of those holds ONE log, where a column means the same thing
 *  in every row — that is what makes a grid worth drawing. This one holds all
 *  nine row types at once, so a shared column is a promise it cannot keep. It
 *  showed: of the seventeen rows on the screen he sent, EIGHT printed a dash
 *  under Amount, and "Seen in QR / Camila Duarte · Looked and left" and
 *  "Payout on its way / To ••••4417" are not two instances of one What+Detail
 *  pair.
 *
 *  So the union prints what every `LogRow` actually owes — which log it is, and
 *  its own sentence — and nothing it has to fill in with a dash. */
const EVERY_COLUMNS: LogColumn<LogRow>[] = [
  {
    key: "log",
    head: "Log",
    cell: (r) => <Badge>{LOG_LABEL[r.log]}</Badge>,
    text: (r) => LOG_LABEL[r.log],
  },
  {
    key: "detail",
    head: "Detail",
    className: "w-full",
    // THE JOIN IS IN THE SENTENCE, and so is the money and the moment. Without
    // the join a card tender and the visit that produced it are two unrelated
    // rows a minute apart; the difference from the old column set is that a row
    // with no money simply does not say any, rather than saying "—".
    cell: (r) => (
      <div className="flex min-w-0 flex-col gap-0.5 py-0.5">
        <span className="font-medium">{r.title}</span>
        <span className="text-muted-foreground text-[12px] leading-snug">
          {everyLine(r)}
        </span>
      </div>
    ),
    text: (r) => everyLine(r),
  },
];

/** The union row's one line: what happened, what it came from, what it moved,
 *  and when. Joined here rather than in the cell so the CSV's own Detail column
 *  and the screen cannot drift apart. */
function everyLine(r: LogRow): string {
  return [
    r.detail,
    r.origin ? `from ${r.origin.label}` : null,
    r.amountCents === null ? null : money(r.amountCents),
    dayTime(r.at),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** WHAT THE UNION EXPORTS, which is NOT what it draws (MESITA-1947).
 *
 *  A spreadsheet is the one place the five columns earn themselves: you sort a
 *  CSV by date and total, and you cannot sort a sentence. The screen lost them
 *  because nine row types cannot fill them; the export keeps them because a
 *  blank cell in a CSV costs nothing and a missing column costs the sort.
 *
 *  Only the union needs the split. Every other tab exports the columns it
 *  draws, which is why `csv` is optional on `TAB_SPECS`. */
const EVERY_CSV_COLUMNS: LogColumn<LogRow>[] = [
  when(),
  {
    key: "log",
    head: "Log",
    cell: (r) => <Badge>{LOG_LABEL[r.log]}</Badge>,
    text: (r) => LOG_LABEL[r.log],
  },
  {
    key: "what",
    head: "What",
    cell: (r) => <span className="font-medium whitespace-nowrap">{r.title}</span>,
    text: (r) => r.title,
  },
  {
    key: "detail",
    head: "Detail",
    cell: (r) => <span className="text-muted-foreground">{r.detail}</span>,
    text: (r) => (r.origin ? `${r.detail} · from ${r.origin.label}` : r.detail),
  },
  {
    key: "amount",
    head: "Amount",
    align: "right",
    cell: (r) => <span className="font-semibold">{money(r.amountCents ?? 0)}</span>,
    text: (r) => csvMoney(r.amountCents),
  },
];

const VIEW_COLUMNS: LogColumn<ViewLogRow>[] = [
  when(),
  {
    key: "surface",
    head: "Surface",
    cell: (r) => <Badge>{r.view.surface}</Badge>,
    text: (r) => r.view.surface,
  },
  {
    key: "who",
    head: "Who",
    cell: (r) =>
      r.view.guest ? (
        <span className="font-medium">{r.view.guest}</span>
      ) : (
        <span className="text-muted-foreground">Signed out</span>
      ),
    text: (r) => r.view.guest ?? "Signed out",
  },
  {
    key: "outcome",
    head: "What they did",
    cell: (r) => r.detail.split(" · ")[1],
    text: (r) => r.detail.split(" · ")[1] ?? "",
  },
];

const VISIT_STATE_TONE = { settled: "on", open: "soon", voided: "bad" } as const;

const VISIT_COLUMNS: LogColumn<VisitLogRow>[] = [
  when(),
  {
    key: "guest",
    head: "Guest",
    cell: (r) => <span className="font-medium">{r.visit.guest}</span>,
    text: (r) => r.visit.guest,
  },
  {
    key: "reward",
    head: "Reward",
    align: "right",
    cell: (r) => (r.visit.rewardCents ? money(r.visit.rewardCents) : "—"),
    text: (r) => csvMoney(r.visit.rewardCents || null),
  },
  {
    key: "credits",
    head: "Credits",
    align: "right",
    cell: (r) => (r.visit.creditsCents ? money(r.visit.creditsCents) : "—"),
    text: (r) => csvMoney(r.visit.creditsCents || null),
  },
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
    text: (r) => r.visit.tenders.map((t) => TENDER_LABEL[t.method]).join(" + "),
  },
  {
    key: "total",
    head: "Total",
    align: "right",
    cell: (r) => <span className="font-semibold">{money(r.visit.totalCents)}</span>,
    text: (r) => csvMoney(r.visit.totalCents),
  },
  {
    key: "state",
    head: "State",
    cell: (r) => <Badge tone={VISIT_STATE_TONE[r.visit.state]}>{r.visit.state}</Badge>,
    text: (r) => r.visit.state,
  },
  {
    key: "wrote",
    head: "Wrote to",
    cell: (r) => <WroteTo keys={r.wroteTo} />,
    text: (r) => wroteToText(r.wroteTo),
  },
];

const ORDER_STATE_TONE = {
  placed: "soon",
  preparing: "soon",
  ready: "on",
  collected: "on",
  canceled: "bad",
} as const;

const ORDER_COLUMNS: LogColumn<OrderLogRow>[] = [
  when(),
  {
    key: "guest",
    head: "Guest",
    cell: (r) => <span className="font-medium">{r.order.guest}</span>,
    text: (r) => r.order.guest,
  },
  {
    key: "channel",
    head: "Channel",
    cell: (r) => <Badge>{r.order.channel}</Badge>,
    text: (r) => r.order.channel,
  },
  {
    key: "items",
    head: "Items",
    align: "right",
    cell: (r) => r.order.items,
    text: (r) => String(r.order.items),
  },
  {
    key: "total",
    head: "Paid",
    align: "right",
    cell: (r) => <span className="font-semibold">{money(r.order.totalCents)}</span>,
    text: (r) => csvMoney(r.order.totalCents),
  },
  {
    key: "state",
    head: "State",
    cell: (r) => <Badge tone={ORDER_STATE_TONE[r.order.state]}>{r.order.state}</Badge>,
    text: (r) => r.order.state,
  },
  {
    key: "wrote",
    head: "Wrote to",
    cell: (r) => <WroteTo keys={r.wroteTo} />,
    text: (r) => wroteToText(r.wroteTo),
  },
];

const RESERVATION_STATE_TONE = {
  requested: "soon",
  confirmed: "on",
  seated: "on",
  no_show: "bad",
  canceled: "bad",
} as const;

const RESERVATION_COLUMNS: LogColumn<ReservationLogRow>[] = [
  when(),
  {
    key: "guest",
    head: "Guest",
    cell: (r) => <span className="font-medium">{r.reservation.guest}</span>,
    text: (r) => r.reservation.guest,
  },
  {
    key: "party",
    head: "Party",
    align: "right",
    cell: (r) => r.reservation.party,
    text: (r) => String(r.reservation.party),
  },
  {
    key: "state",
    head: "State",
    cell: (r) => (
      <Badge tone={RESERVATION_STATE_TONE[r.reservation.state]}>
        {r.reservation.state.replace("_", " ")}
      </Badge>
    ),
    text: (r) => r.reservation.state.replace("_", " "),
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
    text: (r) => r.reservation.note ?? "",
  },
];

const REVIEW_COLUMNS: LogColumn<ReviewLogRow>[] = [
  when(),
  {
    key: "guest",
    head: "Guest",
    cell: (r) => <span className="font-medium">{r.review.guest}</span>,
    text: (r) => r.review.guest,
  },
  {
    key: "where",
    head: "Where",
    cell: (r) => <Badge>{r.review.source}</Badge>,
    text: (r) => r.review.source,
  },
  {
    key: "stars",
    head: "Stars",
    cell: (r) => <span className="tracking-tight">{stars(r.review.stars)}</span>,
    // FIVE GLYPHS ON SCREEN, ONE NUMBER IN THE FILE: "★★★★☆" cannot be
    // averaged, and averaging is what a reviews export is opened for.
    text: (r) => String(r.review.stars),
  },
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
    text: (r) =>
      r.review.source === "google" ? "Not from here" : r.review.reply ? "Answered" : "Waiting",
  },
];

const PAYMENT_COLUMNS: LogColumn<PaymentLogRow>[] = [
  when(),
  {
    key: "direction",
    head: "Direction",
    cell: (r) => (
      <Badge tone={r.direction === "out" ? "off" : "on"}>{r.direction === "out" ? "Out" : "In"}</Badge>
    ),
    text: (r) => (r.direction === "out" ? "Out" : "In"),
  },
  {
    key: "method",
    head: "Method",
    cell: (r) => <Badge>{r.method === "payout" ? "Bank" : TENDER_LABEL[r.method]}</Badge>,
    text: (r) => (r.method === "payout" ? "Bank" : TENDER_LABEL[r.method]),
  },
  {
    key: "party",
    head: "Party",
    cell: (r) => <span className="font-medium">{r.party}</span>,
    text: (r) => r.party,
  },
  {
    key: "from",
    head: "From",
    cell: (r) => <From row={r} />,
    text: (r) => r.origin?.label ?? "",
  },
  {
    key: "amount",
    head: "Amount",
    align: "right",
    cell: (r) => <span className="font-semibold">{money(r.amountCents)}</span>,
    text: (r) => csvMoney(r.amountCents),
  },
];

// CREDITS IS THE ONE LOG THAT RUNS BOTH WAYS, so it carries both join columns.
// A `spent` row is a consequence — it came FROM a visit. An `issued` row is a
// cause — the guest paid for it, so it WROTE a payment. One column could only
// ever show half of that, and the half it showed would depend on the row.
const CREDIT_COLUMNS: LogColumn<CreditLogRow>[] = [
  when(),
  {
    key: "guest",
    head: "Guest",
    cell: (r) => <span className="font-medium">{r.guest}</span>,
    text: (r) => r.guest,
  },
  {
    key: "move",
    head: "Move",
    cell: (r) => <Badge tone={r.move === "issued" ? "on" : "off"}>{r.move}</Badge>,
    text: (r) => r.move,
  },
  {
    key: "from",
    head: "From",
    cell: (r) => <From row={r} />,
    text: (r) => r.origin?.label ?? "",
  },
  {
    key: "wrote",
    head: "Wrote to",
    cell: (r) => <WroteTo keys={r.wroteTo} />,
    text: (r) => wroteToText(r.wroteTo),
  },
  {
    key: "amount",
    head: "Amount",
    align: "right",
    cell: (r) => <span className="font-semibold">{money(r.amountCents)}</span>,
    text: (r) => csvMoney(r.amountCents),
  },
];

const SETTING_COLUMNS: LogColumn<SettingLogRow>[] = [
  when(),
  {
    key: "who",
    head: "Who",
    cell: (r) => <span className="font-medium">{r.change.who}</span>,
    text: (r) => r.change.who,
  },
  {
    key: "area",
    head: "Where",
    cell: (r) => <Badge>{SETTING_AREA_LABEL[r.change.area]}</Badge>,
    text: (r) => SETTING_AREA_LABEL[r.change.area],
  },
  {
    key: "what",
    head: "What",
    cell: (r) => r.change.what,
    text: (r) => r.change.what,
  },
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
    text: (r) => (r.change.from ? `${r.change.from} → ${r.change.to}` : `→ ${r.change.to}`),
  },
];

const SUBSCRIPTION_PRODUCT_LABEL: Record<SubscriptionLogRow["product"], string> = {
  customers: "Customer Catalog",
  membership: "Membership",
};

// THE FIVE WORDS THIS LOG CAN SAY, and the last two are not one word twice:
// `ending` still HAS the product and will lose it, `ended` has lost it. A
// console that painted them the same would tell a venue that is still paying
// it has been cut off.
const SUBSCRIPTION_EVENT = {
  started: { label: "started", tone: "on" },
  renewed: { label: "renewed", tone: "on" },
  payment_failed: { label: "charge failed", tone: "bad" },
  ending: { label: "ending", tone: "soon" },
  ended: { label: "closed", tone: "off" },
} as const;

const SUBSCRIPTION_COLUMNS: LogColumn<SubscriptionLogRow>[] = [
  when(),
  {
    key: "product",
    head: "Product",
    cell: (r) => <span className="font-medium">{SUBSCRIPTION_PRODUCT_LABEL[r.product]}</span>,
    text: (r) => SUBSCRIPTION_PRODUCT_LABEL[r.product],
  },
  {
    key: "event",
    head: "Event",
    cell: (r) => (
      <Badge tone={SUBSCRIPTION_EVENT[r.event].tone}>{SUBSCRIPTION_EVENT[r.event].label}</Badge>
    ),
    text: (r) => SUBSCRIPTION_EVENT[r.event].label,
  },
  {
    key: "cadence",
    head: "Billed",
    cell: (r) => <Badge tone="off">{r.cadence}</Badge>,
    text: (r) => r.cadence,
  },
  {
    key: "detail",
    head: "What it means",
    className: "w-full",
    cell: (r) => <span className="text-muted-foreground">{r.detail}</span>,
    text: (r) => r.detail,
  },
  // NO AMOUNT COLUMN, and the absence is the point: neither product has a
  // price yet, so a column of dashes would read as money nobody moved rather
  // than as a number nobody has decided.
  {
    key: "wrote",
    head: "Wrote to",
    cell: (r) => <WroteTo keys={r.wroteTo} />,
    text: (r) => wroteToText(r.wroteTo),
  },
];

/** EVERY TAB'S TABLE, keyed by the tab. It is a `Record` and not nine branches
 *  in the body on purpose: a mapped type over `Tab` refuses to compile the day
 *  a ninth log joins `LOG_KEYS` without columns, which is exactly what "we
 *  added a log and Activity never showed it" looks like.
 *
 *  `minWidth` is per COLUMN SET, never global — the eight-column Visits table
 *  needs 900px before it wraps a tender list into four lines, and the
 *  four-column Views table at 900 is a third empty. */
const TAB_SPECS: {
  [K in Tab]: {
    columns: LogColumn<K extends "everything" ? LogRow : LedgerBook[Extract<K, LogKey>][number]>[];
    /** What the export writes, when that is not what the screen draws. Only
     *  the union sets it (MESITA-1947); everywhere else the two are one list,
     *  and a second one would be a chance for them to disagree. */
    csv?: LogColumn<K extends "everything" ? LogRow : LedgerBook[Extract<K, LogKey>][number]>[];
    minWidth: number;
  };
} = {
  // 320, not 820: two columns need a fraction of what five did, and anything
  // above 375 scrolls a chip and a sentence sideways on a phone — which is the
  // whole complaint, restaged at one width. The detail cell WRAPS, so this
  // floor only has to fit the chip and a few words beside it.
  everything: { columns: EVERY_COLUMNS, csv: EVERY_CSV_COLUMNS, minWidth: 320 },
  views: { columns: VIEW_COLUMNS, minWidth: 560 },
  visits: { columns: VISIT_COLUMNS, minWidth: 900 },
  orders: { columns: ORDER_COLUMNS, minWidth: 780 },
  reservations: { columns: RESERVATION_COLUMNS, minWidth: 640 },
  reviews: { columns: REVIEW_COLUMNS, minWidth: 660 },
  payments: { columns: PAYMENT_COLUMNS, minWidth: 780 },
  credits: { columns: CREDIT_COLUMNS, minWidth: 780 },
  subscriptions: { columns: SUBSCRIPTION_COLUMNS, minWidth: 860 },
  settings: { columns: SETTING_COLUMNS, minWidth: 740 },
};
