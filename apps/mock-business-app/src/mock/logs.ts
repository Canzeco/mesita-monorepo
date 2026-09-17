// THE LEDGER BOOK — eight logs, PROJECTED from the records, never authored.
//
// Pato, 2026-09-16: *"activity is like the centralized passive feed of
// everything — you configure in products and then in activity you observe the
// shit. Put different tables feeds, not just the passive notification but the
// actual ticket of each. Certain events might produce events in multiple logs:
// a visit might produce one event in visit, one in payment and one in
// credits."*
//
// ── WHY THIS IS A PROJECTION AND NOT A FIXTURE ─────────────────────────────
//
// Activity used to read an `ACTIVITY` array of eight invented one-liners with a
// random amount stapled on: "Visit settled · $1,799.97" beside a Visits table
// that had never heard of that visit. Two hand-authored lists describing one
// place cannot agree, and the moment a reviewer added them up the console was
// caught lying.
//
// So the records are the source and the logs are a READ of them. The union
// feed and the eight tables are the same rows at two resolutions, and the one
// thing that made the old screen wrong — a second place to write down what
// happened — no longer exists.
//
// ── THE FAN-OUT, WHICH IS THE POINT ────────────────────────────────────────
//
// Payments and Credits hold NO RECORDS OF THEIR OWN for the things guests do.
// They are what other records DID:
//
//   a settled visit  → 1 Visits row
//                      + 1 Payments row PER TENDER  (cash, card, Payments)
//                      + 1 Credits row              (spent) if credits applied
//   an order         → 1 Orders row + 1 Payments row   (prepaid, always)
//   a credit sale    → 1 Payments row (in) + 1 Credits row (issued)
//   a payout         → 1 Payments row (out)
//   a view           → 1 Views row, and nothing else
//   a reservation    → 1 Reservations row, and nothing else
//   a review         → 1 Reviews row, and nothing else
//   a change         → 1 Settings row, and nothing else
//
// Four of the eight fan out and four do not, which is the honest shape and the
// reason Views and Reservations earn their place beside the money: a book where
// every entry fed another would teach that the fan-out is the rule.
//
// BECAUSE THE PAYMENT ROWS ARE THE TENDERS, the arithmetic the fixture already
// asserts holds on screen for free: a visit's payment rows plus its credit row
// sum to its total. Nobody has to keep two numbers in step, because there is
// only one.
//
// ── WHAT DOES NOT BECOME A PAYMENT ─────────────────────────────────────────
//
// Only a SETTLED visit moves money. An open visit is a bill still at the table
// — its tenders are what it WILL take — and a voided one gave it back. Both
// still appear in the Visits log, with nothing under "Wrote to", which is the
// screen saying so out loud. A canceled order is the same case.
import {
  CREDIT_PURCHASES,
  GOOGLE_REVIEWS,
  ORDERS,
  PAYOUTS,
  PLACE_VIEWS,
  RESERVATIONS,
  REVIEWS,
  SETTING_CHANGES,
  VISITS,
} from "@/mock/fixtures";
import { listFor, type Scenario } from "@/mock/scenario";
import type {
  MockOrder,
  MockPlaceView,
  MockReservation,
  MockReview,
  MockSettingChange,
  MockTender,
  MockVisit,
} from "@/mock/types";
import { TENDER_LABEL } from "@/lib/tender";
import { money } from "@/lib/format";

/** THE EIGHT, IN PATO'S ORDER, which is the funnel: attention first, then the
 *  four things a guest DOES, then the two money logs those write into, then
 *  what the house changed. Reading the page top to bottom is reading a day. */
export const LOG_KEYS = [
  "views",
  "visits",
  "orders",
  "reservations",
  "reviews",
  "payments",
  "credits",
  "settings",
] as const;
export type LogKey = (typeof LOG_KEYS)[number];

export const LOG_LABEL: Record<LogKey, string> = {
  views: "Views",
  visits: "Visits",
  orders: "Orders",
  reservations: "Reservations",
  reviews: "Reviews",
  payments: "Payments",
  credits: "Credits",
  settings: "Settings",
};

/** WHERE A DERIVED ROW CAME FROM. Null on a source row, which is its own
 *  origin — and a row that is both would be a loop. */
export type LogOrigin = { log: LogKey; id: string; label: string };

type LogBase = {
  id: string;
  at: string;
  /** The one line the UNION feed prints. Every log row owes one, because the
   *  feed has no idea what kind of row it is holding. */
  title: string;
  detail: string;
  /** Null when this row is not about money. A zero would be a measurement. */
  amountCents: number | null;
  origin: LogOrigin | null;
  /** The other logs this row WROTE INTO. Empty on a derived row: a derived row
   *  is somebody else's consequence, never a cause. */
  wroteTo: LogKey[];
};

export type ViewLogRow = LogBase & { log: "views"; view: MockPlaceView };
export type VisitLogRow = LogBase & { log: "visits"; visit: MockVisit };
export type OrderLogRow = LogBase & { log: "orders"; order: MockOrder };
export type ReservationLogRow = LogBase & {
  log: "reservations";
  reservation: MockReservation;
};
export type ReviewLogRow = LogBase & { log: "reviews"; review: MockReview };

/** ONE MOVEMENT OF MONEY. `method` carries the four words this console can
 *  print over a payment: the three tenders, plus the bank. */
export type PaymentLogRow = LogBase & {
  log: "payments";
  method: MockTender["method"] | "payout";
  direction: "in" | "out";
  /** Who the money came from or went to — a guest, or the bank account. */
  party: string;
  amountCents: number;
};

export type CreditLogRow = LogBase & {
  log: "credits";
  move: "issued" | "spent";
  guest: string;
  amountCents: number;
};

export type SettingLogRow = LogBase & {
  log: "settings";
  change: MockSettingChange;
};

export type LogRow =
  | ViewLogRow
  | VisitLogRow
  | OrderLogRow
  | ReservationLogRow
  | ReviewLogRow
  | PaymentLogRow
  | CreditLogRow
  | SettingLogRow;

export type LedgerBook = {
  views: ViewLogRow[];
  visits: VisitLogRow[];
  orders: OrderLogRow[];
  reservations: ReservationLogRow[];
  reviews: ReviewLogRow[];
  payments: PaymentLogRow[];
  credits: CreditLogRow[];
  settings: SettingLogRow[];
  /** Every row above that HAS ALREADY HAPPENED, in one stream, newest first.
   *
   *  THE UNION IS DERIVED FROM THE LOGS and never assembled beside them — that
   *  is the whole reason the feed cannot disagree with the tables under it.
   *
   *  IT STOPS AT `now`, and that is the one place a log and the feed part
   *  company on purpose. Reservations are the only record here dated in the
   *  FUTURE: a booking's `at` is when the table is held, not when somebody
   *  booked it. Sorted into a newest-first stream they take the top of the
   *  feed and the "Newest" tile reads "in 4d" — a feed of everything that
   *  happened, led by four things that have not. The Reservations log keeps
   *  every one of them, because a bookings table is supposed to look
   *  forward. */
  everything: LogRow[];
};

const newestFirst = (a: { at: string }, b: { at: string }) =>
  new Date(b.at).getTime() - new Date(a.at).getTime();

/** THE ONE LOG THAT IS NOT NEWEST-FIRST, and the exception is the point of the
 *  table: a bookings list leads with the next table to seat. Newest-first over
 *  a record dated in the future puts the FURTHEST-OUT booking at the top, which
 *  is the one nobody is about to walk in for. Upcoming ascending, then the ones
 *  that have passed descending — the order `ReservationsView` already claims in
 *  its own description. */
const soonestFirst =
  (now: Date) => (a: { at: string }, b: { at: string }) => {
    const [x, y] = [new Date(a.at).getTime(), new Date(b.at).getTime()];
    const t = now.getTime();
    const ahead = (n: number) => n > t;
    if (ahead(x) !== ahead(y)) return ahead(x) ? -1 : 1;
    return ahead(x) ? x - y : y - x;
  };

const VIEW_SURFACE_LABEL: Record<MockPlaceView["surface"], string> = {
  search: "Search",
  map: "Map",
  swipe: "Swipe",
  link: "Link",
  qr: "QR",
};

const VIEW_OUTCOME_LABEL: Record<MockPlaceView["outcome"], string> = {
  viewed: "Looked and left",
  saved: "Saved the place",
  directions: "Took directions",
  called: "Called",
  shared: "Shared it",
};

const PAYMENT_METHOD_LABEL: Record<PaymentLogRow["method"], string> = {
  ...TENDER_LABEL,
  payout: "Bank",
};

export const SETTING_AREA_LABEL: Record<MockSettingChange["area"], string> = {
  profile: "Profile",
  hours: "Hours",
  menus: "Menus",
  team: "Team",
  orders: "Orders",
  reservations: "Reservations",
  rewards: "Rewards",
  credits: "Credits",
};

/** Read the whole book for one place.
 *
 *  `scenario` goes through `listFor` ONCE PER SOURCE and never over the derived
 *  logs: strip the records and the consequences vanish with them, which is what
 *  the empty scenario is for. Filtering a derived log separately would let the
 *  empty console render a payment from a visit it says does not exist.
 *
 *  `now` is the FIXED instant, never the wall clock — `MOCK_NOW`, through
 *  `useMock`. It decides one thing: where the union feed stops. */
export function buildLedgers(placeId: string, scenario: Scenario, now: Date): LedgerBook {
  const mine = <T extends { placeId: string }>(rows: T[]) =>
    listFor(rows.filter((r) => r.placeId === placeId), scenario);

  const visits = mine(VISITS);
  const orders = mine(ORDERS);
  const reservations = mine(RESERVATIONS);
  const purchases = mine(CREDIT_PURCHASES);
  const payouts = mine(PAYOUTS);
  const views = mine(PLACE_VIEWS);
  const changes = mine(SETTING_CHANGES);
  const reviews = [...mine(REVIEWS), ...mine(GOOGLE_REVIEWS)];

  const payments: PaymentLogRow[] = [];
  const credits: CreditLogRow[] = [];

  // ── VISITS, AND WHAT THEY WRITE ──────────────────────────────────────────
  const visitRows: VisitLogRow[] = visits.map((visit) => {
    const settled = visit.state === "settled";
    const origin: LogOrigin = {
      log: "visits",
      id: visit.id,
      label: `Visit · ${visit.guest}`,
    };
    const wroteTo: LogKey[] = [];

    if (settled && visit.tenders.length > 0) {
      wroteTo.push("payments");
      visit.tenders.forEach((tender, i) => {
        payments.push({
          id: `${visit.id}_pay_${i}`,
          log: "payments",
          at: visit.at,
          title: `${PAYMENT_METHOD_LABEL[tender.method]} taken`,
          detail: `${visit.guest} · closing a bill`,
          amountCents: tender.amountCents,
          origin,
          wroteTo: [],
          method: tender.method,
          direction: "in",
          party: visit.guest,
        });
      });
    }

    if (settled && visit.creditsCents > 0) {
      wroteTo.push("credits");
      credits.push({
        id: `${visit.id}_crd`,
        log: "credits",
        at: visit.at,
        title: "Credits spent",
        detail: `${visit.guest} · off a bill of ${money(visit.totalCents)}`,
        amountCents: visit.creditsCents,
        origin,
        wroteTo: [],
        move: "spent",
        guest: visit.guest,
      });
    }

    return {
      id: visit.id,
      log: "visits",
      at: visit.at,
      title: `Visit ${visit.state}`,
      detail: `${visit.guest} · ${describeVisit(visit)}`,
      amountCents: visit.totalCents,
      origin: null,
      wroteTo,
      visit,
    };
  });

  // ── ORDERS ARE PREPAID, so every one that was not canceled took money at the
  // moment it was placed — through Mesita's own checkout, which is the one
  // tender an order can have.
  const orderRows: OrderLogRow[] = orders.map((order) => {
    const paid = order.state !== "canceled";
    if (paid) {
      payments.push({
        id: `${order.id}_pay`,
        log: "payments",
        at: order.at,
        title: "Payments taken",
        detail: `${order.guest} · ${order.channel} order`,
        amountCents: order.totalCents,
        origin: { log: "orders", id: order.id, label: `Order · ${order.guest}` },
        wroteTo: [],
        method: "mesita_pay",
        direction: "in",
        party: order.guest,
      });
    }
    return {
      id: order.id,
      log: "orders",
      at: order.at,
      title: `Order ${order.state}`,
      detail: `${order.guest} · ${order.channel} · ${order.items} item${order.items === 1 ? "" : "s"}`,
      amountCents: order.totalCents,
      origin: null,
      wroteTo: paid ? ["payments"] : [],
      order,
    };
  });

  // ── A CREDIT SALE IS TWO ROWS AND NEITHER IS THE EVENT. The guest paid
  // money (Payments) and the place minted credit against it (Credits). It has
  // no log of its own on purpose: there is no screen called Credit sales, and
  // inventing one would have been a ninth log for a record that is entirely
  // what it caused.
  for (const purchase of purchases) {
    const origin: LogOrigin = {
      log: "credits",
      id: purchase.id,
      label: `Credit sale · ${purchase.guest}`,
    };
    payments.push({
      id: `${purchase.id}_pay`,
      log: "payments",
      at: purchase.at,
      title: "Payments taken",
      detail: `${purchase.guest} · buying credits`,
      amountCents: purchase.amountCents,
      origin,
      wroteTo: [],
      method: "mesita_pay",
      direction: "in",
      party: purchase.guest,
    });
    credits.push({
      id: `${purchase.id}_crd`,
      log: "credits",
      at: purchase.at,
      title: purchase.gift ? "Credits gifted" : "Credits bought",
      detail: `${purchase.guest} · paid for in full`,
      amountCents: purchase.amountCents,
      // A PURCHASE IS ITS OWN ORIGIN in this log — it is the source row, and
      // the Payments row beside it is the derived one.
      origin: null,
      wroteTo: ["payments"],
      move: "issued",
      guest: purchase.guest,
    });
  }

  // ── THE ONLY MONEY GOING OUT.
  for (const payout of payouts) {
    payments.push({
      id: payout.id,
      log: "payments",
      at: payout.at,
      title: payout.state === "paid" ? "Payout sent" : "Payout on its way",
      detail: `To ••••${payout.last4}`,
      amountCents: payout.amountCents,
      origin: null,
      wroteTo: [],
      method: "payout",
      direction: "out",
      party: `••••${payout.last4}`,
    });
  }

  const viewRows: ViewLogRow[] = views.map((view) => ({
    id: view.id,
    log: "views",
    at: view.at,
    title: `Seen in ${VIEW_SURFACE_LABEL[view.surface]}`,
    detail: `${view.guest ?? "Signed out"} · ${VIEW_OUTCOME_LABEL[view.outcome]}`,
    amountCents: null,
    origin: null,
    wroteTo: [],
    view,
  }));

  const reservationRows: ReservationLogRow[] = reservations.map((reservation) => ({
    id: reservation.id,
    log: "reservations",
    at: reservation.at,
    title: `Reservation ${reservation.state.replace("_", " ")}`,
    detail: `${reservation.guest} · party of ${reservation.party}`,
    // A BOOKING TAKES NO MONEY HERE. The provider holds the table; Mesita
    // holds no deposit, so a peso on this row would be one nobody moved.
    amountCents: null,
    origin: null,
    wroteTo: [],
    reservation,
  }));

  const reviewRows: ReviewLogRow[] = reviews.map((review) => ({
    id: review.id,
    log: "reviews",
    at: review.at,
    title: `${review.stars}-star review`,
    detail: `${review.guest} · on ${review.source === "google" ? "Google" : "Mesita"}`,
    amountCents: null,
    origin: null,
    // A MESITA REVIEW RAISES THE REWARD RATE on a later visit, it does not mint
    // anything — `lib/rewards.ts` adds it to the rate, and a rate is not a row.
    wroteTo: [],
    review,
  }));

  const settingRows: SettingLogRow[] = changes.map((change) => ({
    id: change.id,
    log: "settings",
    at: change.at,
    title: `${SETTING_AREA_LABEL[change.area]} changed`,
    detail: `${change.who} · ${change.what} → ${change.to}`,
    amountCents: null,
    origin: null,
    wroteTo: [],
    change,
  }));

  const book = {
    views: viewRows.sort(newestFirst),
    visits: visitRows.sort(newestFirst),
    orders: orderRows.sort(newestFirst),
    reservations: reservationRows.sort(soonestFirst(now)),
    reviews: reviewRows.sort(newestFirst),
    payments: payments.sort(newestFirst),
    credits: credits.sort(newestFirst),
    settings: settingRows.sort(newestFirst),
  };

  return {
    ...book,
    everything: LOG_KEYS.flatMap((key) => book[key] as LogRow[])
      .filter((row) => new Date(row.at).getTime() <= now.getTime())
      .sort(newestFirst),
  };
}

/** What the union feed says about a visit in half a line. It names the
 *  REDUCTIONS, because those are the part of a visit that is not obvious from
 *  the total beside it. */
function describeVisit(visit: MockVisit): string {
  if (visit.state === "open") return "still at the table";
  if (visit.state === "voided") return "voided, nothing taken";
  if (visit.tenders.length === 0) return "covered by credits";
  const words = visit.tenders.map((t) => TENDER_LABEL[t.method].toLowerCase());
  return visit.creditsCents > 0
    ? `credits and ${words.join(" and ")}`
    : words.join(" and ");
}
