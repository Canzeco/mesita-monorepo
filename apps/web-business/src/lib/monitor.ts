// Monitor's plain linked lists (MESITA-4538, Pato: "SIMPLE LISTS … the lists
// have ids and those ids redirect to other tickets across the Monitor
// subpages"). The words, formats and links every list shares. A plain module:
// the server sends raw values, this says them.

import { moneyLabel } from "@mesita/place-profile/lib/money";

export const MONITOR_KINDS = ["visits", "vouchers", "gifts", "payments", "credits"] as const;
export type MonitorKind = (typeof MONITOR_KINDS)[number];

export type LinkKind = "visit" | "payment" | "voucher" | "credit";
export type MonitorLink = { kind: LinkKind; id: string };

export type MonitorRow = {
  id: string;
  at: string;
  rank: number;
  /** The guest's per-place key, or null for a deleted guest. */
  customer: string | null;
  other_customer: string | null;
  /** Masked by the server; null with no customer. */
  guest: string | null;
  other: string | null;
  /** The guest's photo, VIP and Instagram mark (MESITA-4554). */
  face?: { avatar_url: string | null; vip: boolean; instagram: boolean } | null;
  other_face?: { avatar_url: string | null; vip: boolean; instagram: boolean } | null;
  payload: Record<string, unknown>;
  links: MonitorLink[];
};

export type MonitorCursor = { rank: number; at: string; id: string } | null;

/** Synthesized by the EF from the raw rows on every load (MESITA-4677). */
export type VisitsAnalytics = {
  visits: number;
  open: number;
  guests: number;
  returning: number;
  visits7d: number;
  visits30d: number;
  billed_cents: number;
  tips_cents: number;
  average_bill_cents: number;
};
export type VouchersAnalytics = {
  vouchers: number;
  guests: number;
  returning: number;
  vouchers7d: number;
  vouchers30d: number;
  paid_cents: number;
  bonus_cents: number;
  refunded_cents: number;
};
export type MonitorAnalytics = ({ kind: "visits" } & VisitsAnalytics) | ({ kind: "vouchers" } & VouchersAnalytics);

export type MonitorPage = {
  test_mode: boolean;
  kind: MonitorKind;
  timezone: string;
  rows: MonitorRow[];
  next: MonitorCursor;
  /** Visits and Vouchers, first unfiltered page only. */
  analytics?: VisitsAnalytics | VouchersAnalytics;
};

export type MonitorFilter = { id?: string | null; customer?: string | null };

export type CustomerRow = {
  customer: string;
  owed_cents: number;
  last_seen: string;
  guest: string;
  face?: { avatar_url: string | null; vip: boolean; instagram: boolean } | null;
  /** MESITA-4682: the Customers table's columns, computed by the server. */
  saved: boolean;
  visits: number;
  /** Paid bills and tips, less what was refunded. */
  spent_cents: number;
  vouchers: number;
};
export type CustomerCursor = { owed: number; last_seen: string; key: string } | null;
export type CustomersPage = {
  test_mode: boolean;
  timezone: string;
  count: number;
  owed_cents: number;
  rows: CustomerRow[];
  next: CustomerCursor;
};

export type Payout = {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  arrival_date: string | null;
  created: string | null;
  bank: string | null;
  failure_message: string | null;
};
export type PayoutsAnswer =
  | { state: "ok"; payouts: Payout[]; next: string | null }
  | { state: "no_account" }
  | { state: "stripe_error" };

// ── Formats ─────────────────────────────────────────────────────────────

/** "$1,200.00". Every place is MXN today. */
export function money(cents: number, currency = "MXN"): string {
  return moneyLabel(cents, currency.toUpperCase());
}

/** "+$50.00" / "−$50.00" for the credit ledger, in normal ink. */
export function signedMoney(cents: number, currency = "MXN"): string {
  if (cents === 0) return money(0, currency);
  return `${cents > 0 ? "+" : "−"}${money(Math.abs(cents), currency)}`;
}

/** "21 Nov, 14:32"; the year only when it is not this year. */
export function when(iso: string, timezone: string): string {
  const d = new Date(iso);
  const thisYear = new Date().toLocaleString("en-GB", { year: "numeric", timeZone: timezone });
  const year = d.toLocaleString("en-GB", { year: "numeric", timeZone: timezone });
  const day = d.toLocaleString("en-GB", { day: "numeric", month: "short", timeZone: timezone });
  const time = d.toLocaleString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone });
  return `${day}${year === thisYear ? "" : ` ${year}`}, ${time}`;
}

/** "23 Nov" for a payout's arrival. */
export function day(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", timeZone: timezone });
}

/** "#A1B2C3": the first six hex of an id. The full id is the link target. */
export function shortId(id: string): string {
  return `#${id.replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

/** A raw value nobody mapped yet, in sentence case; never blank. */
function raw(v: unknown): string {
  const s = String(v ?? "").replace(/_/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "Unknown";
}

// ── Status words ────────────────────────────────────────────────────────

const VISIT: Record<string, string> = {
  waiting_bill: "Open",
  billed: "Billed",
  paying: "Paying",
  paid: "Paid",
  expired: "Expired",
  cancelled: "Cancelled",
};
const PURCHASE: Record<string, string> = {
  paid: "Paid",
  refunded: "Refunded",
  partly_refunded: "Partly refunded",
  needs_review: "Needs review",
};
const PAYMENT: Record<string, string> = {
  opening: "Opening",
  open: "Open",
  paid: "Paid",
  failed: "Failed",
  expired: "Expired",
  refunded: "Refunded",
  partly_refunded: "Partly refunded",
  needs_review: "Needs review",
};
const PAYOUT: Record<string, string> = {
  paid: "Paid",
  in_transit: "In transit",
  pending: "Pending",
  failed: "Failed",
  canceled: "Canceled",
};
const GIFT: Record<string, string> = { open: "Open link", claimed: "Claimed", taken_back: "Taken back" };
/** The cashback line a credit came from (wallet_entries.reason, MESITA-4766). */
const CASHBACK_REASON: Record<string, string> = {
  welcome: "Welcome Regular",
  welcome_vip: "Welcome VIP",
  returning: "Returning Regular",
  returning_vip: "Returning VIP",
};

/** A cashback line's name, or null for a reason this app does not know. */
export function cashbackReason(reason: unknown): string | null {
  return typeof reason === "string" ? (CASHBACK_REASON[reason] ?? null) : null;
}

export function payoutStatus(status: string): string {
  return PAYOUT[status] ?? raw(status);
}

/** The one status word on a row. */
export function rowStatus(kind: MonitorKind, row: MonitorRow): string {
  const p = row.payload;
  if (kind === "visits") return VISIT[String(p.status)] ?? raw(p.status);
  if (kind === "vouchers") return PURCHASE[String(p.status)] ?? raw(p.status);
  if (kind === "payments") return PAYMENT[String(p.status)] ?? raw(p.status);
  if (kind === "gifts") return GIFT[String(p.status)] ?? raw(p.status);
  return creditLabel(row);
}

/** What a credit ledger row is (MESITA-4538, the wallet_entries kind map). */
export function creditLabel(row: MonitorRow): string {
  const p = row.payload;
  const other = row.other ?? "a friend";
  switch (p.kind) {
    case "prepay":
    case "voucher":
      return "Credit bought";
    case "bonus":
      return "Bonus credit";
    case "cashback": {
      const line = cashbackReason(p.reason);
      return line ? `Cashback on a bill · ${line}` : "Cashback on a bill";
    }
    // Instagram Stories are gone (MESITA-4766); old story credits still show.
    case "story":
      return "Instagram Story credit";
    case "spend":
      return "Spent on a visit";
    case "refund":
      return "Returned by a refund";
    case "reversal":
      return "Taken back (refund or dispute)";
    case "gift_out":
      if (p.gift_status === "open") return "Gift link (open)";
      return `Gift sent to ${other} · ${GIFT[String(p.gift_status)] ?? raw(p.gift_status)}`;
    case "gift_in":
      return `Gift from ${other}`;
    case "gift_back":
      return "Gift link taken back";
    default:
      return raw(p.kind);
  }
}

/** Whether the status word is worth showing: "Paid" on a paid bill or
 *  voucher is the normal case and only adds noise (MESITA-4554). */
export function statusWorthShowing(kind: MonitorKind, row: MonitorRow): boolean {
  if (kind === "payments" || kind === "vouchers") return row.payload.status !== "paid";
  return true;
}

/** The grey detail after the status: what the row is about. */
export function rowDetail(kind: MonitorKind, row: MonitorRow): string | null {
  const p = row.payload;
  const n = (k: string) => Number(p[k] ?? 0);
  if (kind === "visits") {
    return [p.waiter_name, p.ticket ? `Ticket ${p.ticket}` : null].filter(Boolean).join(" · ") || null;
  }
  if (kind === "vouchers") {
    // The voucher's name is its badge (VoucherBadge); the line keeps the bonus.
    return n("bonus_cents") > 0 ? `+${money(n("bonus_cents"))} bonus` : null;
  }
  if (kind === "payments") {
    const parts = [
      n("card_cents") > 0 ? `Card ${money(n("card_cents"))}` : null,
      n("credit_cents") > 0 ? `Credit ${money(n("credit_cents"))}` : null,
      n("outside_cents") > 0 ? `Cash ${money(n("outside_cents"))}` : null,
      n("tip_cents") > 0 ? `Tip ${money(n("tip_cents"))}` : null,
      n("refunded_cents") + n("credit_refunded_cents") > 0 ? `${money(n("refunded_cents") + n("credit_refunded_cents"))} refunded` : null,
    ].filter(Boolean);
    return parts.join(" · ") || null;
  }
  return null;
}

/** The row's amount on the right. */
export function rowAmount(kind: MonitorKind, row: MonitorRow): string {
  const p = row.payload;
  const n = (k: string) => Number(p[k] ?? 0);
  if (kind === "visits") return p.bill_cents == null ? "Waiting for the bill" : money(n("bill_cents") + n("tip_cents"));
  if (kind === "vouchers") return money(n("amount_cents"));
  if (kind === "payments") return money(n("amount_cents") + n("tip_cents") + n("outside_cents"));
  if (kind === "gifts") return money(n("amount_cents"), String(p.currency ?? "mxn"));
  return signedMoney(n("amount_cents"), String(p.currency ?? "mxn"));
}

// ── Links ───────────────────────────────────────────────────────────────

const LINK_LABEL: Record<LinkKind, string> = {
  visit: "Visit",
  payment: "Payment",
  voucher: "Voucher",
  credit: "Credit",
};

export function linkLabel(link: MonitorLink): string {
  return `${LINK_LABEL[link.kind]} ${shortId(link.id)}`;
}

function base(placeId: string): string {
  return `/places/${encodeURIComponent(placeId)}`;
}

/** Where a related row lives: its page, filtered to that one row. */
export function linkHref(placeId: string, link: MonitorLink): string {
  const id = encodeURIComponent(link.id);
  switch (link.kind) {
    case "visit":
      return `${base(placeId)}/visits?id=${id}`;
    case "payment":
      return `${base(placeId)}/money?id=${id}`;
    case "voucher":
      return `${base(placeId)}/vouchers?id=${id}`;
    case "credit":
      return `${base(placeId)}/credits?id=${id}`;
  }
}

/** "Customer #A1B2C3": the first six of the per-place guest key. */
export function customerLabel(customer: string): string {
  return `Customer #${customer.slice(0, 6).toUpperCase()}`;
}

/** One guest on Customers. */
export function customerHref(placeId: string, customer: string): string {
  return `${base(placeId)}/customers?id=${encodeURIComponent(customer)}`;
}

/** The page of one kind filtered to one guest. */
export function customerListHref(placeId: string, page: "views" | "visits" | "vouchers" | "gifts" | "money", customer: string): string {
  return `${base(placeId)}/${page}?customer=${encodeURIComponent(customer)}`;
}

/** A link kind's page, for "+N" overflow: the parent's guest filter there. */
export function linkKindPage(kind: LinkKind): "visits" | "money" | "vouchers" | null {
  if (kind === "visit") return "visits";
  if (kind === "payment") return "money";
  if (kind === "voucher") return "vouchers";
  if (kind === "credit") return null;
  return null;
}

/** A uuid from a search param, or null. */
export function uuidParam(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^[0-9a-f-]{36}$/i.test(s) ? s : null;
}

/** A per-place guest key from a search param, or null. */
export function customerParam(v: string | string[] | undefined): string | null {
  const s = Array.isArray(v) ? v[0] : v;
  return s && /^[0-9a-f]{32}$/.test(s) ? s : null;
}

export const EMPTY: Record<MonitorKind | "customers" | "views", string> = {
  visits: "No visits yet.",
  vouchers: "No vouchers yet.",
  payments: "No payments yet.",
  credits: "No credit movements yet.",
  gifts: "No gifts claimed yet.",
  customers: "No customers yet.",
  views: "No views yet.",
};

export const NOUN: Record<MonitorKind, { one: string; many: string }> = {
  visits: { one: "visit", many: "visits" },
  vouchers: { one: "voucher", many: "vouchers" },
  payments: { one: "payment", many: "payments" },
  credits: { one: "credit movement", many: "credit movements" },
  gifts: { one: "gift", many: "gifts" },
};
