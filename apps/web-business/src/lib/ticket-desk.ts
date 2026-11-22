// The words on Operations' ticket desk (MESITA-4487; the Monitor lists reuse
// voucherName since MESITA-4538, and the chart types went with the charts). A plain module so the
// status a owner reads is pinned: a voucher says its product name, a visit
// says Open or Paid. Money formatting
// stays with the caller.

export const TICKET_KINDS = ["visits", "vouchers", "gifts"] as const;
export type TicketKind = (typeof TICKET_KINDS)[number];

type RowBase = { id: string; at: string; rank: number; guest: string };

export type VisitTicket = RowBase & {
  status: string;
  open: boolean;
  origin: string;
  bill_cents: number | null;
  tip_cents: number;
  ticket: string | null;
  waiter_name: string | null;
};

export type VoucherTicket = RowBase & {
  status: string;
  voucher: string | null;
  amount_cents: number;
  bonus_cents: number;
  refunded_cents: number;
};

export type GiftTicket = RowBase & {
  status: string;
  amount_cents: number;
  currency: string;
  other: string | null;
};

export type TicketRow = VisitTicket | VoucherTicket | GiftTicket;

const VOUCHER: Record<string, string> = {
  voucher_200: "Small Voucher",
  voucher_1000: "Medium Voucher",
  voucher_5000: "Big Voucher",
  // Never sold since MESITA-4641; an old purchase keeps its name (the
  // purchase row stores the voucher as text).
  voucher_story: "Story Voucher",
  voucher_vip: "VIP Voucher",
};

const VISIT: Record<string, string> = {
  waiting_bill: "Open",
  billed: "Billed",
  paying: "Paying",
  paid: "Paid",
};

const PURCHASE: Record<string, string> = {
  paid: "Paid",
  refunded: "Refunded",
  partly_refunded: "Partly refunded",
  needs_review: "Needs review",
};

const GIFT: Record<string, string> = {
  open: "Open link",
  claimed: "Claimed",
  taken_back: "Taken back",
};

/** The product name of a voucher code; "Voucher" for one off the list (a retired Welcome, MESITA-4636). */
export function voucherName(code: string | null): string {
  if (!code) return "Voucher";
  return VOUCHER[code] ?? "Voucher";
}

/** The one status word on a ticket row. */
export function ticketStatus(kind: TicketKind, row: TicketRow): string {
  if (kind === "visits") return VISIT[(row as VisitTicket).status] ?? (row as VisitTicket).status;
  if (kind === "vouchers") return PURCHASE[(row as VoucherTicket).status] ?? (row as VoucherTicket).status;
  return GIFT[(row as GiftTicket).status] ?? (row as GiftTicket).status;
}

/** The log clock, the place's, the same words Views uses. */
export function ticketWhen(iso: string, timezone: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: timezone,
  });
}

/** The grey line under the guest. */
export function ticketLine(kind: TicketKind, row: TicketRow): string {
  if (kind === "visits") {
    const v = row as VisitTicket;
    return [v.waiter_name, v.ticket ? `Ticket ${v.ticket}` : null].filter(Boolean).join(" · ");
  }
  if (kind === "vouchers") return voucherName((row as VoucherTicket).voucher);
  const g = row as GiftTicket;
  if (g.status === "open") return "Waiting for a friend.";
  if (g.status === "claimed") return g.other ? `Taken by ${g.other}.` : "Taken.";
  return "The sender took it back.";
}
