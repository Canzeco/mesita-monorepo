// The words on Operations' ticket desk (MESITA-4487; the Monitor lists reuse
// voucherName since MESITA-4538, and the chart types went with the charts). A plain module so the
// status a owner reads is pinned: a Story in `found` says it needs a look,
// a voucher says its product name, a visit says Open or Paid. Money formatting
// stays with the caller.

export const TICKET_KINDS = ["visits", "vouchers", "stories", "gifts"] as const;
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

export type StoryTicket = RowBase & {
  state: string;
  void_reason: string | null;
  bonus_cents: number;
  deadline_at: string;
};

export type GiftTicket = RowBase & {
  status: string;
  amount_cents: number;
  currency: string;
  other: string | null;
};

export type TicketRow = VisitTicket | VoucherTicket | StoryTicket | GiftTicket;

const VOUCHER: Record<string, string> = {
  voucher_200: "Small Voucher",
  voucher_1000: "Medium Voucher",
  voucher_5000: "Big Voucher",
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

const STORY: Record<string, string> = {
  found: "Needs a look",
  waiting_post: "Waiting for the post",
  approved: "Approved",
  released: "Bonus paid",
  void: "Void",
};

const VOID: Record<string, string> = {
  expired: "Expired",
  deleted: "Deleted",
  unreachable: "Could not re-check",
  refunded: "Refunded",
  operator: "Voided by Mesita",
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
  if (kind === "gifts") return GIFT[(row as GiftTicket).status] ?? (row as GiftTicket).status;
  const story = row as StoryTicket;
  if (story.state === "void") return VOID[story.void_reason ?? ""] ?? "Void";
  return STORY[story.state] ?? story.state;
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
  if (kind === "stories") {
    const s = row as StoryTicket;
    if (s.state === "found") return "Posted. A person at the place still has to look.";
    if (s.state === "waiting_post") return "Bought. The guest has not posted yet.";
    if (s.state === "approved") return "Looked at. The bonus waits for the re-check.";
    if (s.state === "released") return "The bonus was paid.";
    return "Closed.";
  }
  const g = row as GiftTicket;
  if (g.status === "open") return "Waiting for a friend.";
  if (g.status === "claimed") return g.other ? `Taken by ${g.other}.` : "Taken.";
  return "The sender took it back.";
}
