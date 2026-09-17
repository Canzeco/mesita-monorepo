// THE LEDGER BOOK — nine logs, PROJECTED from the records, never authored.
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
// feed and the nine tables are the same rows at two resolutions, and the one
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
//   a subscription   → 1 Subscriptions row, and nothing else
//
// Four of the nine fan out and five do not, which is the honest shape and the
// reason Views and Reservations earn their place beside the money: a book where
// every entry fed another would teach that the fan-out is the rule.
//
// ── THE ONE MONEY LOG THAT WRITES NOWHERE (MESITA-1944) ────────────────────
//
// Subscriptions is what MESITA bills this PLACE — the Customers catalog
// monthly, the Membership yearly — and it is the only log here whose money
// runs in that direction. It writes no Payments row ON PURPOSE: Payments is
// this place's own Stripe Connect account, guests paying in and the bank
// taking out, and a subscription charge never touches it. A row there saying
// the venue's Stripe moved money Mesita took on a card would be the console
// lying about whose account it is.
//
// AND IT CARRIES NO PRICES. Neither product has one yet — the Customers page
// says so in as many words — and a mock that invented a number would be the
// only place in the company where that price existed.
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
  MockPlace,
  MockPlaceView,
  MockReservation,
  MockReview,
  MockSettingChange,
  MockTender,
  MockVisit,
} from "@/mock/types";
import { TENDER_LABEL } from "@/lib/tender";
import { money } from "@/lib/format";
// ONE RENEWAL DATE FORMAT IN THIS CONSOLE. It lives beside the strip that
// invented it (`membershipDate`, a FIXED en-GB spelling rather than the
// viewer's locale, so a screenshot is byte-identical an hour later). A second
// Intl config here would be two screens printing one day two ways — and the
// day is a YEAR out, which is exactly the case where dropping the year makes
// "Sep 16" read as this week.
import { membershipDate } from "@/components/console/PartnerCard";

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
  // What the HOUSE owes and what the house changed, in that order, after
  // everything a guest did. Subscriptions is money and sits beside the money;
  // Settings stays last because it is the only log with no money in it at all.
  "subscriptions",
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
  subscriptions: "Subscriptions",
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

/** WHAT MESITA BILLS THIS PLACE. Two products, one lifecycle each.
 *
 *  `product` and not a free string, because the two are billed on different
 *  clocks — the catalog monthly, the Membership yearly — and a log that could
 *  not tell them apart could not say which one the next charge is for. */
export type SubscriptionLogRow = LogBase & {
  log: "subscriptions";
  product: "customers" | "membership";
  /** `ending` is CANCELLED BUT STILL RUNNING, which is not `ended`: one is a
   *  place that still has the product and will lose it, the other has lost it.
   *  Collapsing them is how a console tells a paying venue it has been cut
   *  off. */
  event: "started" | "renewed" | "payment_failed" | "ending" | "ended";
  /** "Monthly" or "Yearly". The clock, printed, because a renewal with no
   *  cadence beside it cannot be checked against the next date. */
  cadence: string;
};

export type LogRow =
  | ViewLogRow
  | VisitLogRow
  | OrderLogRow
  | ReservationLogRow
  | ReviewLogRow
  | PaymentLogRow
  | CreditLogRow
  | SubscriptionLogRow
  | SettingLogRow;

export type LedgerBook = {
  views: ViewLogRow[];
  visits: VisitLogRow[];
  orders: OrderLogRow[];
  reservations: ReservationLogRow[];
  reviews: ReviewLogRow[];
  payments: PaymentLogRow[];
  credits: CreditLogRow[];
  subscriptions: SubscriptionLogRow[];
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

/** THE SUBSCRIPTION HISTORY, PROJECTED FROM THE PLACE'S OWN STATE.
 *
 *  Every other log here reads records; this one reads the switches, because
 *  there are no subscription records to read — the console knows `partnered`,
 *  `membership`, `renewsAt`, `customerIntel` and `customerIntelSince`, and a
 *  fixture array beside them could disagree with all five. Projecting from the
 *  state instead means the log cannot contradict the Membership strip, the
 *  Customers page or the States card, whatever the panel is set to.
 *
 *  THE CATALOG CARRIES THE HISTORY: one `started` and a `renewed` per month
 *  since. The Membership carries ONE ROW, the one its current state implies —
 *  `renewsAt` is the only date the fixture holds for it, so any history older
 *  than that would be invented, and an invented year of renewals is the kind
 *  of number somebody eventually adds up. */
function subscriptionRows(place: MockPlace, now: Date): SubscriptionLogRow[] {
  const rows: SubscriptionLogRow[] = [];
  const iso = (d: Date) => d.toISOString();
  const shift = (from: Date, days: number, hours = 0) =>
    new Date(from.getTime() - days * 86_400_000 - hours * 3_600_000);

  // ── THE CATALOG, MONTHLY ────────────────────────────────────────────────
  //
  // Three states, not two. Running and CLOSED are both a history; never opened
  // is an empty log, and the difference is `customerIntelSince`. A place the
  // panel just switched on has no date behind it and started today, which is
  // the truth about what the panel did.
  const since = place.customerIntelSince ?? (place.customerIntel ? iso(shift(now, 0, 3)) : null);
  if (since) {
    const start = new Date(since);
    rows.push({
      id: `sub_cus_start`,
      log: "subscriptions",
      at: since,
      title: "Customers subscription started",
      detail: "The catalog opened — every guest of this place, named.",
      amountCents: null,
      origin: null,
      wroteTo: [],
      product: "customers",
      event: "started",
      cadence: "Monthly",
    });

    // A renewal per 30 days elapsed. Counted from the start rather than
    // written down, so the log stays right if the start date moves.
    const months = Math.floor((now.getTime() - start.getTime()) / (30 * 86_400_000));
    for (let m = 1; m <= months; m++) {
      rows.push({
        id: `sub_cus_renew_${m}`,
        log: "subscriptions",
        at: iso(new Date(start.getTime() + m * 30 * 86_400_000)),
        title: "Customers subscription renewed",
        detail: `Month ${m + 1} · the catalog stayed open`,
        amountCents: null,
        origin: null,
        wroteTo: [],
        product: "customers",
        event: "renewed",
        cadence: "Monthly",
      });
    }

    if (!place.customerIntel) {
      rows.push({
        id: `sub_cus_end`,
        log: "subscriptions",
        at: iso(shift(now, 0, 2)),
        title: "Customers catalog closed",
        detail: "The rows went back behind the glass. Nothing of them was kept.",
        amountCents: null,
        origin: null,
        wroteTo: [],
        product: "customers",
        event: "ended",
        cadence: "Monthly",
      });
    }
  }

  // ── THE MEMBERSHIP, YEARLY ──────────────────────────────────────────────
  //
  // `none` writes NOTHING, and that is the operator-switch partner: a place
  // somebody turned on by hand has never been charged, so a billing log with a
  // row in it would be the one screen claiming it was.
  if (place.partnered && place.membership !== "none" && place.renewsAt) {
    const date = membershipDate(place.renewsAt);
    const said =
      place.membership === "past_due"
        ? {
            title: "Membership charge failed",
            detail: "Stripe is retrying. Still a partner — nothing has been taken away.",
            event: "payment_failed" as const,
          }
        : place.membership === "cancelling"
          ? {
              title: "Membership ending",
              detail: `Cancelled. Paid through ${date}, and it will not renew.`,
              event: "ending" as const,
            }
          : {
              title: "Membership renewed",
              detail: `Another year · next on ${date}`,
              event: "renewed" as const,
            };
    rows.push({
      id: "sub_mem",
      log: "subscriptions",
      at: iso(shift(now, 0, 4)),
      title: said.title,
      detail: said.detail,
      amountCents: null,
      origin: null,
      wroteTo: [],
      product: "membership",
      event: said.event,
      cadence: "Yearly",
    });
  }

  return rows;
}

/** Read the whole book for one place.
 *
 *  `scenario` goes through `listFor` ONCE PER SOURCE and never over the derived
 *  logs: strip the records and the consequences vanish with them, which is what
 *  the empty scenario is for. Filtering a derived log separately would let the
 *  empty console render a payment from a visit it says does not exist.
 *
 *  `now` is the FIXED instant, never the wall clock — `MOCK_NOW`, through
 *  `useMock`. It decides one thing: where the union feed stops. */
export function buildLedgers(place: MockPlace, scenario: Scenario, now: Date): LedgerBook {
  // THE PLACE, NOT ITS ID (MESITA-1944). Eight logs read records and needed
  // only the id to filter them; Subscriptions reads the place's own switches,
  // and they arrive already overridden by the scenario — reading round
  // `resolveWorld` for them would render a subscription the panel cannot move.
  const placeId = place.id;
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

  // EMPTIED WITH EVERY OTHER LOG. `listFor` strips records; this log has none
  // to strip, so the empty scenario is applied here by hand — a console that
  // says every list is empty and then shows six subscription rows is a console
  // with an exception nobody asked for.
  const subscriptions = scenario.empty ? [] : subscriptionRows(place, now);

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
    subscriptions: subscriptions.sort(newestFirst),
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
