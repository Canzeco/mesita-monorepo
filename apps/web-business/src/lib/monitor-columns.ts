// The Monitor tables' columns (MESITA-4682, Pato: "THE CUSTOMERS PAGE CAN DO
// BE A TABLE … vouchers … gifts … visits too, express them in one table").
// One definition per table drives both the screen and the CSV export, so the
// two never drift. Every value is the server's; this only says it.

import { voucherName } from "@/lib/ticket-desk";
import {
  customerLabel,
  customerListHref,
  linkHref,
  linkLabel,
  money,
  rowStatus,
  shortId,
  when,
  type CustomerRow,
  type MonitorKind,
  type MonitorRow,
} from "@/lib/monitor";

export type TableKind = "visits" | "vouchers" | "gifts" | "payments";
export const TABLE_KINDS: readonly MonitorKind[] = ["visits", "vouchers", "gifts", "payments"];

/** What a bill collected: the printed bill less its visit discount, plus the
 *  tip (MESITA-4770: cash + credit add up to bill - discount). */
export function collectedCents(row: MonitorRow): number {
  return n(row, "bill_cents") - n(row, "discount_cents") + n(row, "tip_cents");
}

export type Column<R> = {
  label: string;
  /** Right-aligned, tabular figures. */
  numeric?: boolean;
  text: (row: R, timezone: string) => string;
  /** Columns that share this name sit under one header above them. */
  group?: string;
  /** The cell links here on screen (the CSV keeps the words). */
  href?: (row: R, placeId: string) => string | null;
};

const n = (row: MonitorRow, k: string) => Number(row.payload[k] ?? 0);
const dash = (cents: number) => (cents > 0 ? money(cents) : "—");
const isSplit = (row: MonitorRow) => row.payload.split === true;

/** The guest cell's words, for the CSV (the screen draws face and name). */
export function guestText(row: MonitorRow): string {
  return row.guest ?? "Deleted guest";
}

export const MONITOR_COLUMNS: Record<TableKind, Column<MonitorRow>[]> = {
  // How each bill was paid (MESITA-4684, Pato: "Like amount paid in x, in y,
  // in z … the tip is another type of payment"): Card, Outside and Credit
  // under one Bill header, read from the bill row (MESITA-4682); the tip
  // stands apart.
  visits: [
    { label: "When", text: (r, tz) => when(r.at, tz) },
    { label: "Status", text: (r) => (isSplit(r) ? `Split · ${n(r, "shares")}` : rowStatus("visits", r)) },
    // CREDIT OR CASH, NEVER CARD (Pato, 2026-11-22, MESITA-4703: "credits or
    // cash, but never mesita pay, mesita pay only for vouchers"): no Card
    // column; Cash is what was paid outside (cash or the place's terminal).
    { label: "Cash", group: "Bill", numeric: true, text: (r) => (isSplit(r) ? "—" : dash(n(r, "outside_cents"))) },
    { label: "Credit", group: "Bill", numeric: true, text: (r) => (isSplit(r) ? "—" : dash(n(r, "credit_cents"))) },
    { label: "Tip", numeric: true, text: (r) => dash(n(r, "tip_cents")) },
    {
      label: "Total",
      numeric: true,
      text: (r) =>
        isSplit(r)
          ? money(n(r, "shares_total_cents"))
          : r.payload.bill_cents == null
            ? "—"
            : money(collectedCents(r)),
    },
    // The credit this bill earned (MESITA-4698), from the bill's cashback entry.
    { label: "Cashback", numeric: true, text: (r) => dash(n(r, "cashback_cents")) },
    { label: "Ticket", text: (r) => (r.payload.ticket ? String(r.payload.ticket) : "—") },
    { label: "Waiter", text: (r) => (r.payload.waiter_name ? String(r.payload.waiter_name) : "—") },
    { label: "ID", text: (r) => shortId(r.id) },
  ],
  vouchers: [
    { label: "Voucher", text: (r) => voucherName((r.payload.voucher as string | null) ?? null) },
    { label: "When", text: (r, tz) => when(r.at, tz) },
    { label: "Paid", numeric: true, text: (r) => money(n(r, "amount_cents")) },
    { label: "Bonus", numeric: true, text: (r) => dash(n(r, "bonus_cents")) },
    { label: "Refunded", numeric: true, text: (r) => dash(n(r, "refunded_cents")) },
    { label: "Status", text: (r) => rowStatus("vouchers", r) },
    { label: "ID", text: (r) => shortId(r.id) },
  ],
  gifts: [
    { label: "To", text: (r) => r.other ?? (r.payload.status === "open" ? "Not taken yet" : "—") },
    { label: "When", text: (r, tz) => when(r.at, tz) },
    { label: "Amount", numeric: true, text: (r) => money(n(r, "amount_cents"), String(r.payload.currency ?? "mxn")) },
    { label: "Status", text: (r) => rowStatus("gifts", r) },
    { label: "ID", text: (r) => shortId(r.id) },
  ],
  // Stripe card charges only (MESITA-4682, Pato: "just mention the Stripe
  // Payments events"): no refund columns.
  payments: [
    { label: "When", text: (r, tz) => when(r.at, tz) },
    { label: "Amount", numeric: true, text: (r) => money(n(r, "card_cents") + n(r, "tip_cents")) },
    { label: "Status", text: (r) => (r.payload.status === "paid" ? "Paid" : rowStatus("payments", r)) },
    {
      label: "Visit",
      text: (r) => r.links.filter((l) => l.kind === "visit").map(linkLabel).join(" ") || "—",
      href: (r, placeId) => {
        const v = r.links.find((l) => l.kind === "visit");
        return v ? linkHref(placeId, v) : null;
      },
    },
    { label: "ID", text: (r) => shortId(r.id) },
  ],
};

export const CUSTOMER_COLUMNS: Column<CustomerRow>[] = [
  { label: "Saved", text: (c) => (c.saved ? "Yes" : "—") },
  { label: "Visits", numeric: true, text: (c) => String(c.visits), href: (c, placeId) => (c.visits > 0 ? customerListHref(placeId, "visits", c.customer) : null) },
  { label: "Spent", numeric: true, text: (c) => money(c.spent_cents) },
  { label: "Credit", numeric: true, text: (c) => money(c.owed_cents) },
  { label: "Vouchers", numeric: true, text: (c) => String(c.vouchers), href: (c, placeId) => (c.vouchers > 0 ? customerListHref(placeId, "vouchers", c.customer) : null) },
  { label: "Last seen", text: (c, tz) => when(c.last_seen, tz) },
];

export function customerGuestText(c: CustomerRow): string {
  return `${c.guest} (${customerLabel(c.customer)})`;
}

/** A CSV cell a spreadsheet will not run as a formula. */
export function safeCell(v: string): string {
  return /^[=+\-@\t\r]/.test(v) && !/^-?\d/.test(v) ? `'${v}` : v;
}
