// Pay at the table (MESITA-3559; T1a MESITA-3567 is the ledger, T1b
// MESITA-3562 these doors).
//
// The guest opens a tab at a place and shows its QR; the waiter scans it on
// visit.mesita.ai/tab/<token>, types the place code once (MESITA-3462's
// 12-hour staff token after that), the bill and a tip suggestion; the guest's
// screen reads the bill by polling and chooses how to pay the bill (credits
// first, the rest in cash) and the tip (cash; never credits); the waiter
// types the cash received (or nothing: exactly what is owed). The card part
// (T2b, MESITA-3563, _shared/tab-card.ts) pays the bill and/or the tip with a
// saved card inside the app; credits never pay a tip.
//
//   consumer-web-open-tab    pay_tab_open        the guest's QR
//   consumer-web-get-tab     reads               the guest's poll
//   consumer-web-pay-tab     pay_tab_open_parts  the guest's split
//   consumer-web-cancel-tab  pay_tab_change      cancel, or change how to pay
//   visit-web-get-tab        reads               the waiter's poll
//   visit-web-bill-tab       pay_tab_bill        the waiter's bill
//   visit-web-cash-tab       pay_tab_cash        the waiter's Received
//   consumer-web-split-tab   pay_tab_split       split among friends, or
//                            pay_tab_set_share   change one's own share
//   consumer-web-join-tab    pay_tab_join        a friend takes a share
//
// Friends split one bill (MESITA-3695): the guest's billed tab becomes the
// TABLE and every payer holds a SHARE, an ordinary tab under it
// (parent_tab_id) billed with the share; a share pays exactly as a whole tab
// does. The table is paid when its paid shares cover the bill (a trigger);
// a share starts paying only if it fits in what is left (a trigger, under the
// table's row lock). Friends join with the table's join token, never the
// waiter's token; the waiter's screen lists the shares (never who holds them)
// and confirms each cash share by its id under the table's token.
//
// Keys: the QR token (128 bits, 22 base64url characters) is stored only as
// a hash and never logged; anyone holding it reads the bill state, never who
// the guest is. Billing and Received need staff (a place code or a staff
// token of the tab's place): the guest's token alone never confirms cash.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { MAX_PAYMENT_INPUT_CENTS, OUTSIDE_MAX_PER_DAY } from "./money.ts";
import { isUuid } from "./place-id.ts";
import { readPlaceCode } from "./place-code.ts";
import { isProofToken, mintProofToken, tabUrl } from "./proof.ts";
import { clientAddress, readTicket, staffTryKey } from "./charge.ts";
import { staffAccess, supabaseStaffStore } from "./staff.ts";

export const WAITER_NAME_MAX = 40;

export type TabRefusal = { ok: false; status: number; code: string; error: string; detail?: Record<string, unknown> };

export function refuse(status: number, code: string, error: string, detail?: Record<string, unknown>): TabRefusal {
  return { ok: false, status, code, error, ...(detail ? { detail } : {}) };
}

// ── Keys ────────────────────────────────────────────────────────────────────

export const isTabToken = isProofToken;
export const mintTabToken = mintProofToken;
export { tabUrl };

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function hashTabToken(token: string): Promise<string> {
  return sha256Hex(`tab-token:${token}`);
}

/** The hash of the staff token that billed the tab (pay_tabs.staff_key_hash). */
export function hashTabStaffKey(staffToken: string): Promise<string> {
  return sha256Hex(`tab-staff:${staffToken}`);
}

// ── Reading what arrives ────────────────────────────────────────────────────

function cents(v: unknown, { min }: { min: number }): number | null {
  if (v === undefined || v === null) return min === 0 ? 0 : null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < min || v > MAX_PAYMENT_INPUT_CENTS) return null;
  return v;
}

export type StaffKeyInput = { placeCode: string | null; staffToken: string | null };

function readStaffKey(b: Record<string, unknown>): StaffKeyInput {
  const staffToken = typeof b.staff_token === "string" && b.staff_token.length <= 128 ? b.staff_token : null;
  return { staffToken, placeCode: staffToken ? null : readPlaceCode(b.place_code) };
}

export type BillInput = StaffKeyInput & {
  token: string;
  billCents: number;
  tipCents: number;
  ticket: string | null;
  waiterName: string | null;
  billVersion: number;
};

export function readBillBody(b: Record<string, unknown>): { ok: true; input: BillInput } | TabRefusal {
  if (!isTabToken(b.token)) return refuse(400, "bad_request", "That is not a tab");
  const bill = cents(b.bill_cents, { min: 1 });
  if (bill === null) return refuse(400, "amount_required", "Type the bill", { cap_cents: MAX_PAYMENT_INPUT_CENTS });
  const tip = cents(b.tip_cents, { min: 0 });
  if (tip === null) return refuse(400, "tip_invalid", "Type a tip like 30 or 30.50", { cap_cents: MAX_PAYMENT_INPUT_CENTS });
  const t = readTicket(b.ticket);
  if (!t.ok) return refuse(t.status, t.code ?? "bad_request", t.error);
  let waiterName: string | null = null;
  if (b.waiter_name !== undefined && b.waiter_name !== null) {
    if (typeof b.waiter_name !== "string") return refuse(400, "bad_request", "waiter_name must be text");
    // deno-lint-ignore no-control-regex
    const n = b.waiter_name.trim().replace(/[\u0000-\u001f\u007f]/g, "");
    if (n.length > WAITER_NAME_MAX) return refuse(400, "bad_request", `A name is at most ${WAITER_NAME_MAX} characters`);
    waiterName = n === "" ? null : n;
  }
  const v = b.bill_version;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0) return refuse(400, "bad_request", "bill_version must be the version you read");
  const key = readStaffKey(b);
  if (!key.placeCode && !key.staffToken) return refuse(403, "staff_only", "Type the place code");
  return { ok: true, input: { token: b.token, billCents: bill, tipCents: tip, ticket: t.ticket, waiterName, billVersion: v, ...key } };
}

export type CashInput = StaffKeyInput & { token: string; receivedCents: number | null };

export function readCashBody(b: Record<string, unknown>): { ok: true; input: CashInput } | TabRefusal {
  if (!isTabToken(b.token)) return refuse(400, "bad_request", "That is not a tab");
  let received: number | null = null;
  if (b.cash_received_cents !== undefined && b.cash_received_cents !== null) {
    received = cents(b.cash_received_cents, { min: 0 });
    if (received === null) return refuse(400, "amount_required", "Type the cash you received");
  }
  const key = readStaffKey(b);
  if (!key.placeCode && !key.staffToken) return refuse(403, "staff_only", "Type the place code");
  return { ok: true, input: { token: b.token, receivedCents: received, ...key } };
}

export type SplitInput = {
  tabId: string;
  billVersion: number;
  creditCents: number;
  cashBillCents: number;
  cashTipCents: number;
  cardBillCents: number;
  cardTipCents: number;
  /** The saved card (a platform PaymentMethod) for a card part. */
  cardPmId: string | null;
  requestId: string;
};

/** The guest's split. Every part is a whole number of centavos, 0 to the cap;
 *  the sums and the credit are the SQL's to check, under the pair lock. */
export function readSplitBody(b: Record<string, unknown>): { ok: true; input: SplitInput } | TabRefusal {
  if (!isUuid(b.tab_id)) return refuse(400, "bad_request", "tab_id must be a tab id");
  if (!isUuid(b.request_id)) return refuse(400, "bad_request", "request_id must be a uuid");
  const v = b.bill_version;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) return refuse(400, "bad_request", "bill_version must be the version you read");
  if (b.credit_tip_cents !== undefined && b.credit_tip_cents !== 0) {
    return refuse(400, "tip_by_credit", "Credits never pay a tip");
  }
  const parts = ["credit_cents", "cash_bill_cents", "cash_tip_cents", "card_bill_cents", "card_tip_cents"].map((k) => cents(b[k], { min: 0 }));
  if (parts.some((p) => p === null)) return refuse(400, "parts", "Each part is a whole number of centavos");
  const [credit, cashBill, cashTip, cardBill, cardTip] = parts as number[];
  let cardPmId: string | null = null;
  if (cardBill > 0 || cardTip > 0) {
    if (typeof b.card_pm_id !== "string" || !/^pm_[A-Za-z0-9]{8,64}$/.test(b.card_pm_id)) {
      return refuse(400, "card_required", "Choose a saved card");
    }
    cardPmId = b.card_pm_id;
  }
  return {
    ok: true,
    input: {
      tabId: b.tab_id,
      billVersion: v,
      creditCents: credit,
      cashBillCents: cashBill,
      cashTipCents: cashTip,
      cardBillCents: cardBill,
      cardTipCents: cardTip,
      cardPmId,
      requestId: b.request_id,
    },
  };
}

/** The guest's own payment (MESITA-3707): the bill they typed and how they
 *  pay it. Parts are checked by the SQL (they must sum to the bill). */
export type GuestPayInput = Omit<SplitInput, "tabId" | "billVersion"> & {
  placeId: string;
  billCents: number;
  /** MESITA-3776: the ticket number as typed, trimmed; null = none given. */
  ticket: string | null;
  /** MESITA-3776: "Yes, my share": pay a ticket another guest already paid. */
  repeatOk: boolean;
};

/** The guest's ticket number: 1 to 16 letters, digits, spaces, dashes or
 *  slashes (pay_tab_guest_pay checks the same). */
const GUEST_TICKET = /^[A-Za-z0-9 /-]{1,16}$/;

export function readGuestPayBody(b: Record<string, unknown>): { ok: true; input: GuestPayInput } | TabRefusal {
  if (!isUuid(b.place_id)) return refuse(400, "bad_request", "place_id must be a Mesita place id");
  const bill = cents(b.bill_cents, { min: 1 });
  if (bill === null) return refuse(400, "amount_required", "Type the amount you're paying");
  let ticket: string | null = null;
  if (b.ticket !== undefined && b.ticket !== null) {
    if (typeof b.ticket !== "string") return refuse(400, "ticket_invalid", REFUSALS.ticket_invalid[1]);
    const t = b.ticket.trim();
    if (t !== "" && !GUEST_TICKET.test(t)) return refuse(400, "ticket_invalid", REFUSALS.ticket_invalid[1]);
    ticket = t === "" ? null : t;
  }
  if (b.repeat_ok !== undefined && b.repeat_ok !== null && typeof b.repeat_ok !== "boolean") {
    return refuse(400, "bad_request", "repeat_ok must be true or false");
  }
  const parsed = readSplitBody({ ...b, tab_id: b.place_id, bill_version: 1 });
  if (!parsed.ok) return parsed;
  const { tabId: _t, billVersion: _v, ...parts } = parsed.input;
  return { ok: true, input: { ...parts, placeId: b.place_id, billCents: bill, ticket, repeatOk: b.repeat_ok === true } };
}

/** pay_tab_guest_pay raises `guest_refused:<json>` on any refusal (so the
 *  whole call rolls back); this reads it back as the refusal it carries. */
export function guestRefusal(message: string | undefined): Record<string, unknown> | null {
  const m = /^guest_refused:(\{.*\})$/s.exec(message ?? "");
  if (!m) return null;
  try {
    const r = JSON.parse(m[1]) as Record<string, unknown>;
    return { ...r, ok: false };
  } catch {
    return { ok: false, code: "refused" };
  }
}

// ── What the functions answer ───────────────────────────────────────────────

const REFUSALS: Record<string, [number, string]> = {
  not_found: [404, "This tab is gone"],
  split_locked: [409, "Friends are splitting this bill. Each pays their share."],
  share_too_big: [409, "That's more than what's left of the bill"],
  share_invalid: [400, "Choose a share of the bill"],
  table_closed: [409, "This bill is closed"],
  nothing_left: [409, "Nothing is left to pay on this bill"],
  expired: [409, "This tab expired. Open a new one."],
  cancelled: [409, "The guest cancelled this tab"],
  not_billed: [409, "The waiter has not sent the bill yet"],
  paying: [409, "The guest is already paying this tab"],
  paid: [409, "This tab is paid"],
  stale: [409, "The bill changed. Check it and try again."],
  parts: [409, "The parts must add up to the bill"],
  card_unavailable: [409, "This place isn't taking cards right now. Pay with credits or cash."],
  card_tip_alone: [409, "A tip by card needs part of the bill by card or credits"],
  card_pending: [409, "The guest's card is still going through"],
  insufficient: [409, "Your credit changed. Try again."],
  outside_limit: [409, "You have paid the waiter here enough times today. Pay with credits instead."],
  closed: [409, "That payment was cancelled. Tap again to start over."],
  taken: [409, "This payment already went through"],
  staff_key: [403, "Type the place code"],
  short: [409, "Not enough cash yet"],
  no_cash: [409, "There is no cash to collect on this tab"],
  paid_part: [409, "Part of this tab is already paid"],
  billed: [409, "The waiter already sent the bill"],
  waiting_bill: [409, "The waiter has not sent the bill yet"],
  amount_required: [400, "Type an amount"],
  // MESITA-3707: guest pays, waiter verifies.
  forbidden: [403, "This payment is for another place"],
  verified: [409, "The waiter already verified this payment"],
  not_paid: [409, "This payment is not paid yet"],
  guest_tab: [409, "This payment can only be cancelled"],
  // MESITA-3772: one open guest payment at a time; the detail names it
  // (open_tab_id, open_place_id).
  too_many_open: [409, "Get your open payment signed or close it before paying again."],
  not_guest: [409, "Only a payment you made yourself can be closed"],
  staff_code_needed: [403, "Type the waiter code"],
  // MESITA-3776: the guest's ticket number. ticket_paid carries no time and
  // no amount; ticket_paid_by_you carries paid_tab_id.
  ticket_invalid: [400, "That ticket number isn't valid."],
  ticket_paid: [409, "This ticket already has a payment."],
  ticket_paid_by_you: [409, "You already paid this ticket."],
};

/** An RPC's `{ ok: false, code }` as the function answers it. */
export function rpcRefusal(r: Record<string, unknown>): TabRefusal {
  const code = typeof r.code === "string" ? r.code : "refused";
  const [status, error] = REFUSALS[code] ?? [409, "That did not go through"];
  const { ok: _ok, code: _code, ...detail } = r;
  return refuse(status, code, error, Object.keys(detail).length ? detail : undefined);
}

export type TabRow = {
  id: string;
  place_id: string;
  consumer_id: string | null;
  status: string;
  currency: string;
  livemode: boolean;
  bill_cents: number | null;
  tip_cents: number;
  ticket: string | null;
  bill_version: number;
  waiter_name: string | null;
  staff_key_hash: string | null;
  credit_cents: number;
  cash_bill_cents: number;
  cash_tip_cents: number;
  card_bill_cents: number;
  card_tip_cents: number;
  cash_received_cents: number | null;
  billed_at: string | null;
  paying_at: string | null;
  paid_at: string | null;
  expires_at: string;
  updated_at: string;
  /** Read only by the guest's list (consumer-web-list-visits). */
  created_at?: string;
  /** MESITA-3695: a share's table; a table's split. */
  parent_tab_id?: string | null;
  split_at?: string | null;
  split_ways?: number | null;
  /** MESITA-3707: who started the tab, and when a staff phone verified it. */
  origin?: "waiter" | "guest";
  verified_at?: string | null;
  verified_key_hash?: string | null;
  /** MESITA-3843: why a guest bill ended unpaid (cancelled, rejected,
   *  expired, capture_failed), and a capture in progress at the signature. */
  end_reason?: string | null;
  signing_at?: string | null;
};

export type TabPartRow = {
  id: string;
  part: string | null;
  status: string;
  credit_cents: number;
  outside_cents: number;
  card_cents: number;
  tip_cents: number;
  cashback_cents: number;
  paid_at: string | null;
  proof_token: string | null;
  created_at: string;
  /** MESITA-3772: the rates stored on the row when it started (card part:
   *  cashback_bps; cash part: outside_cashback_bps). */
  cashback_bps?: number;
  outside_cashback_bps?: number;
  /** MESITA-3827: the credit part's rate stamped on the row, and what it
   *  earned once written (cashback_cents stays the card or cash part). */
  credit_cashback_bps?: number;
  credit_cashback_cents?: number;
  /** MESITA-3856: when Stripe held this card part for the waiter. */
  held_at?: string | null;
};

export const TAB_COLUMNS =
  "id, place_id, consumer_id, status, currency, livemode, bill_cents, tip_cents, ticket, bill_version, waiter_name, staff_key_hash, credit_cents, cash_bill_cents, cash_tip_cents, card_bill_cents, card_tip_cents, cash_received_cents, billed_at, paying_at, paid_at, expires_at, updated_at, created_at, parent_tab_id, split_at, split_ways, origin, verified_at, verified_key_hash, end_reason, signing_at";
const PART_COLUMNS =
  "id, part, status, credit_cents, outside_cents, card_cents, tip_cents, cashback_cents, paid_at, proof_token, created_at, cashback_bps, outside_cashback_bps, credit_cashback_bps, credit_cashback_cents, held_at";
/** The guest's list reads only what a status needs (MESITA-3688): never
 *  `proof_token`, which PART_COLUMNS carries. */
export const LIST_PART_COLUMNS = "id, tab_id, status, paid_at";

/** A tab past its time reads expired before any sweep writes it, unless a
 *  part is still in flight. */
export function effectiveStatus(t: TabRow, parts: TabPartRow[], nowMs: number): string {
  if (!["waiting_bill", "billed", "paying"].includes(t.status)) return t.status;
  if (Date.parse(t.expires_at) > nowMs) return t.status;
  if (parts.some((p) => p.status === "open" || p.status === "opening")) return t.status;
  return parts.some((p) => p.paid_at) ? "paid" : "expired";
}

/** The amounts both screens show, from the tab's split. Cashback: the
 *  place's own rates (MESITA-3589): cashBackBps on the cash bill part,
 *  cardBackBps on the card bill part; never on credits or the tip. Once a
 *  part is paid the stored cashback is the answer. */
export function tabMoney(t: TabRow, parts: TabPartRow[], cashBackBps: number, cardBackBps = 0) {
  const live = parts.filter((p) => p.status !== "expired" && p.status !== "failed");
  const cashbackPaid = live.reduce((s, p) => s + (p.paid_at ? p.cashback_cents + (p.credit_cashback_cents ?? 0) : 0), 0);
  return {
    credit_cents: t.credit_cents,
    cash_bill_cents: t.cash_bill_cents,
    cash_tip_cents: t.cash_tip_cents,
    cash_due_cents: t.cash_bill_cents + t.cash_tip_cents,
    cash_received_cents: t.cash_received_cents,
    card_bill_cents: t.card_bill_cents,
    card_tip_cents: t.card_tip_cents,
    cashback_cents: cashbackPaid ||
      Math.floor((t.cash_bill_cents * Math.max(0, cashBackBps)) / 10_000) +
        Math.floor((t.card_bill_cents * cardBackBps) / 10_000),
  };
}

/** MESITA-3772: a guest tab earns cashback only when the waiter signs it.
 *  What signing would earn now: each card part settled or still going
 *  through (its stored rate, else the place's card rate) plus the cash part
 *  (its stored rate, else the place's cash rate), as pay_tab_verify writes
 *  it (the cash part's daily caps may cut it there). 0 for a waiter's tab,
 *  and once the tab is signed, cancelled, closed or past its window. */
export function cashbackOnSign(t: TabRow, parts: TabPartRow[], cashBackBps: number, cardBackBps: number, nowMs: number): number {
  if ((t.origin ?? "waiter") !== "guest" || t.verified_at) return 0;
  if (!["paying", "paid"].includes(t.status) || Date.parse(t.expires_at) <= nowMs) return 0;
  const live = parts.filter((p) => ["opening", "open", "paid", "partly_refunded"].includes(p.status));
  const card = live
    .filter((p) => p.part === "card" && !(p.paid_at && p.cashback_cents > 0))
    .reduce((s, p) => s + Math.floor((p.card_cents * Math.max(0, p.cashback_bps ?? cardBackBps)) / 10_000), 0);
  const cashRows = live.filter((p) => p.part === "outside");
  const cash = cashRows.length
    ? cashRows.filter((p) => !p.paid_at).reduce((s, p) => s + Math.floor((p.outside_cents * Math.max(0, p.outside_cashback_bps ?? cashBackBps)) / 10_000), 0)
    : t.status === "paying" ? Math.floor((t.cash_bill_cents * Math.max(0, cashBackBps)) / 10_000) : 0;
  // MESITA-3827: the credit part's Credits Payments Cashback, at the row's
  // stamped rate, wherever the credit sits (a card, cash or credit row).
  const credit = live
    .filter((p) => !((p.credit_cashback_cents ?? 0) > 0))
    .reduce((s, p) => s + Math.floor((p.credit_cents * Math.max(0, p.credit_cashback_bps ?? 0)) / 10_000), 0);
  return card + cash + credit;
}

/** MESITA-3772: what a guest tab's parts were actually granted. */
export function cashbackGranted(parts: TabPartRow[]): number {
  return parts.reduce((s, p) => s + (p.paid_at ? p.cashback_cents + (p.credit_cashback_cents ?? 0) : 0), 0);
}

// ── Friends split one bill (MESITA-3695) ────────────────────────────────────

/** A share's money as both tables read it. `status` is the share's own,
 *  effective (a share past its time reads expired unless a part is moving). */
export type ShareView = {
  id: string;
  status: string;
  share_cents: number;
  tip_cents: number;
  cash_due_cents: number;
  cash_received_cents: number | null;
};

export type TableView = {
  tab_id: string;
  status: string;
  bill_cents: number;
  tip_suggested_cents: number;
  ways: number | null;
  /** Paid shares. */
  paid_cents: number;
  /** Shares paying or paid: what can no longer be taken. */
  taken_cents: number;
  /** The bill less what is taken: what a share may still pay. */
  left_cents: number;
  shares: ShareView[];
};

const SHARE_LIVE = ["billed", "paying", "paid"];

/** The table and its shares, as the screens show it. Expired and cancelled
 *  shares are left out: they hold nothing. */
export function tableView(table: TabRow, shares: TabRow[], nowMs: number): TableView {
  const live = shares
    // Only a billed share runs out by the clock here: a paying one has a
    // part in flight that its own reads and the waiter's Received settle.
    .map((s) => ({ s, status: s.status === "billed" ? effectiveStatus(s, [], nowMs) : s.status }))
    .filter(({ status }) => SHARE_LIVE.includes(status));
  const paid = live.filter((x) => x.status === "paid").reduce((n, x) => n + (x.s.bill_cents ?? 0), 0);
  const taken = live.filter((x) => x.status !== "billed").reduce((n, x) => n + (x.s.bill_cents ?? 0), 0);
  const bill = table.bill_cents ?? 0;
  const status = table.status === "billed" && Date.parse(table.expires_at) <= nowMs && !live.some((x) => x.status === "paying")
    ? "expired"
    : table.status;
  return {
    tab_id: table.id,
    status,
    bill_cents: bill,
    tip_suggested_cents: table.tip_cents,
    ways: table.split_ways ?? null,
    paid_cents: paid,
    taken_cents: taken,
    left_cents: Math.max(bill - taken, 0),
    shares: live.map(({ s, status }) => ({
      id: s.id,
      status,
      share_cents: s.bill_cents ?? 0,
      tip_cents: status === "billed" ? s.tip_cents : s.cash_tip_cents + s.card_tip_cents,
      cash_due_cents: s.cash_bill_cents + s.cash_tip_cents,
      cash_received_cents: s.cash_received_cents,
    })),
  };
}

export async function readShares(admin: SupabaseClient, tableId: string): Promise<TabRow[]> {
  const { data, error } = await admin.from("pay_tabs").select(TAB_COLUMNS).eq("parent_tab_id", tableId).order("created_at", { ascending: true });
  if (error) throw new Error(`pay_tab_shares_read: ${error.message}`);
  return (data ?? []) as TabRow[];
}

/** A share's id under its table, for the waiter's Received. Its token hash
 *  never leaves the server. */
export async function readShareTokenHash(admin: SupabaseClient, tableId: string, shareId: string): Promise<string | null> {
  const { data, error } = await admin.from("pay_tabs").select("token_hash").eq("id", shareId).eq("parent_tab_id", tableId).maybeSingle();
  if (error) throw new Error(`pay_tab_share_read: ${error.message}`);
  return (data as { token_hash: string } | null)?.token_hash ?? null;
}

export type SplitTabInput =
  | { kind: "split"; tabId: string; ways: number; shareCents: number }
  | { kind: "whole"; tabId: string }
  | { kind: "share"; tabId: string; shareCents: number };

/** consumer-web-split-tab's body: split (ways and the guest's share), stop
 *  splitting (`whole: true`), or a share's new amount (`share_cents` alone,
 *  on a share). Which one fits the tab is the SQL's to say. */
export function readSplitTabBody(b: Record<string, unknown>): { ok: true; input: SplitTabInput } | TabRefusal {
  if (!isUuid(b.tab_id)) return refuse(400, "bad_request", "tab_id must be a tab id");
  if (b.whole === true) return { ok: true, input: { kind: "whole", tabId: b.tab_id } };
  const share = cents(b.share_cents, { min: 1 });
  if (share === null) return refuse(400, "share_invalid", "Choose a share of the bill");
  if (b.ways === undefined || b.ways === null) return { ok: true, input: { kind: "share", tabId: b.tab_id, shareCents: share } };
  const ways = b.ways;
  if (typeof ways !== "number" || !Number.isInteger(ways) || ways < 2 || ways > 20) {
    return refuse(400, "share_invalid", "Split between 2 and 20 people");
  }
  return { ok: true, input: { kind: "split", tabId: b.tab_id, ways, shareCents: share } };
}

export function hashJoinToken(token: string): Promise<string> {
  return sha256Hex(`tab-join:${token}`);
}

export type TabCardInfo = {
  card_available: boolean;
  card_unavailable_code: string | null;
  card_back_bps: number;
  card_minimum_cents: number;
};

const NO_CARD: TabCardInfo = { card_available: false, card_unavailable_code: "not_configured", card_back_bps: 0, card_minimum_cents: 0 };

export function guestTabView(t: TabRow, parts: TabPartRow[], extra: {
  placeName: string | null;
  spendableCents: number;
  /** Cash Payments is on here (MESITA-3589): a cash part is allowed. */
  cashOk: boolean;
  /** What the cash bill part earns here, in bps (0 = no cashback). */
  cashBackBps: number;
  nowMs: number;
  card?: TabCardInfo;
  table?: (TableView & { mine: boolean }) | null;
  myShareTabId?: string | null;
}) {
  const card = extra.card ?? NO_CARD;
  const cashBps = extra.cashOk ? extra.cashBackBps : 0;
  const money = tabMoney(t, parts, cashBps, card.card_back_bps);
  const guest = (t.origin ?? "waiter") === "guest";
  return {
    tab_id: t.id,
    place: { id: t.place_id, name: extra.placeName },
    status: effectiveStatus(t, parts, extra.nowMs),
    currency: t.currency,
    bill_cents: t.bill_cents,
    tip_suggested_cents: t.tip_cents,
    bill_version: t.bill_version,
    ticket: t.ticket,
    waiter_name: t.waiter_name,
    spendable_cents: extra.spendableCents,
    rates: {
      cash_available: extra.cashOk,
      cash_back_bps: extra.cashOk ? extra.cashBackBps : 0,
      card_back_bps: card.card_back_bps,
      card_available: card.card_available,
      card_unavailable_code: card.card_unavailable_code,
      card_minimum_cents: card.card_minimum_cents,
    },
    ...money,
    // MESITA-3772: on a guest tab cashback_cents is what was granted (the
    // signature turns it on); cashback_on_sign_cents is what signing would
    // earn now.
    ...(guest ? { cashback_cents: cashbackGranted(parts) } : {}),
    cashback_on_sign_cents: cashbackOnSign(t, parts, cashBps, card.card_back_bps, extra.nowMs),
    // MESITA-3780: each part's money and its stored rate, so the Visit page
    // can say what every method charged. Never `proof_token`.
    parts: parts.map((p) => ({
      id: p.id,
      part: p.part,
      status: p.status,
      paid_at: p.paid_at,
      created_at: p.created_at,
      credit_cents: p.credit_cents,
      cash_cents: p.outside_cents,
      card_cents: p.card_cents,
      tip_cents: p.tip_cents,
      cashback_cents: p.cashback_cents,
      cashback_bps: (p.part === "outside" ? p.outside_cashback_bps : p.cashback_bps) ?? null,
      // MESITA-3856: a card held for the waiter, not still going through.
      held_at: p.held_at ?? null,
    })),
    // MESITA-3780: the visit's timeline.
    created_at: t.created_at ?? null,
    billed_at: t.billed_at,
    paying_at: t.paying_at,
    paid_at: t.paid_at,
    expires_at: t.expires_at,
    updated_at: t.updated_at,
    test_mode: !t.livemode,
    // MESITA-3695: a share reads its table; a split table names the guest's
    // own share (the app opens it).
    table: extra.table ?? null,
    my_share_tab_id: extra.myShareTabId ?? null,
    // MESITA-3707: a guest tab ends with the waiter's Verify.
    origin: t.origin ?? "waiter",
    verified_at: t.verified_at ?? null,
    // MESITA-3861: Not paid says why; Confirming shows while the card is
    // being charged at the signature.
    end_reason: t.end_reason ?? null,
    signing: !!t.signing_at,
  };
}

/** The cashback rate stamped on the live card part, 0 without one. */
function cardPartBps(parts: TabPartRow[]): number {
  const card = parts.find((p) => p.part === "card" && p.status !== "expired" && p.status !== "failed");
  return Math.max(0, card?.cashback_bps ?? 0);
}

/** What the waiter's screen reads: never who the guest is. */
export function staffTabView(
  t: TabRow,
  parts: TabPartRow[],
  extra: { placeName: string | null; cashBackBps: number; nowMs: number; table?: TableView | null; guestPhoto?: string | null },
) {
  return {
    place: { id: t.place_id, name: extra.placeName },
    status: effectiveStatus(t, parts, extra.nowMs),
    currency: t.currency,
    bill_cents: t.bill_cents,
    tip_suggested_cents: t.tip_cents,
    bill_version: t.bill_version,
    ticket: t.ticket,
    waiter_name: t.waiter_name,
    billed: t.staff_key_hash !== null && t.bill_cents !== null,
    // MESITA-3910: the card part earns at the rate stamped on its row.
    ...tabMoney(t, parts, extra.cashBackBps, cardPartBps(parts)),
    paid_at: t.paid_at,
    expires_at: t.expires_at,
    updated_at: t.updated_at,
    test_mode: !t.livemode,
    // MESITA-3695: a split table's shares, by id (never who holds them).
    table: extra.table ?? null,
    // MESITA-3707: a guest tab is verified, not billed; which phone did it
    // is compared by the caller (never the hash itself).
    origin: t.origin ?? "waiter",
    verified_at: t.verified_at ?? null,
    // MESITA-3708: Verify waits for a card still going through; a card held
    // for the waiter (MESITA-3856) is ready to sign.
    card_pending: parts.some((p) => p.part === "card" && (p.status === "opening" || p.status === "open") && !p.held_at),
    // MESITA-3857: why a guest bill ended (Not charged / no longer open), the
    // card being charged at the signature (Confirming), and the guest's
    // profile photo on a guest bill — a face to match, never a name.
    end_reason: t.end_reason ?? null,
    signing: !!t.signing_at,
    guest_photo: extra.guestPhoto ?? null,
  };
}

// ── The database ────────────────────────────────────────────────────────────

export async function readTabById(admin: SupabaseClient, tabId: string): Promise<TabRow | null> {
  const { data, error } = await admin.from("pay_tabs").select(TAB_COLUMNS).eq("id", tabId).maybeSingle();
  if (error) throw new Error(`pay_tabs_read: ${error.message}`);
  return (data as TabRow | null) ?? null;
}

export async function readTabByToken(admin: SupabaseClient, token: string): Promise<TabRow | null> {
  const { data, error } = await admin.from("pay_tabs").select(TAB_COLUMNS).eq("token_hash", await hashTabToken(token)).maybeSingle();
  if (error) throw new Error(`pay_tabs_read: ${error.message}`);
  return (data as TabRow | null) ?? null;
}

export async function readTabParts(admin: SupabaseClient, tabId: string): Promise<TabPartRow[]> {
  const { data, error } = await admin.from("wallet_payments").select(PART_COLUMNS).eq("tab_id", tabId).order("created_at", { ascending: true });
  if (error) throw new Error(`tab_parts_read: ${error.message}`);
  return (data ?? []) as TabPartRow[];
}

export type Rpc = Pick<SupabaseClient, "rpc">;

export async function callTabRpc(admin: Rpc, fn: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) {
    // MESITA-3695: the split guards raise (rolling the whole call back);
    // their message is the refusal code, share_too_big carries what is left.
    const m = /^(split_locked|share_too_big|table_closed|paid_part)(?::(\d+))?$/.exec(error.message ?? "");
    if (m) return { ok: false, code: m[1], ...(m[2] !== undefined ? { left_cents: Number(m[2]) } : {}) };
    // MESITA-3707: the guest's tap raises its refusal so nothing survives it.
    const g = guestRefusal(error.message);
    if (g) return g;
    throw new Error(`${fn}: ${error.message}`);
  }
  const r = (data ?? null) as Record<string, unknown> | null;
  if (!r) throw new Error(`${fn}: no answer`);
  return r;
}

/** What a card part adds to the call: the place's account, Mesita's fee
 *  (5% of the card bill part, invoiced), the 5% the card bill part earns,
 *  the card row's proof token and when an unfinished one is cancelled. */
export type CardSplitArgs = {
  stripeAccountId: string;
  feeCents: number;
  cashbackBps: number;
  expiresAt: string;
};

/** The split as pay_tab_open_parts takes it. */
export function splitArgs(consumerId: string, s: SplitInput, cashBackBps: number, card?: CardSplitArgs | null) {
  return {
    ...(card
      ? {
        p_stripe_account_id: card.stripeAccountId,
        p_card_fee_cents: card.feeCents,
        p_card_cashback_bps: card.cashbackBps,
        p_card_proof_token: mintProofToken(),
        p_card_expires_at: card.expiresAt,
      }
      : {}),
    p_tab_id: s.tabId,
    p_consumer_id: consumerId,
    p_bill_version: s.billVersion,
    p_credit_cents: s.creditCents,
    p_cash_bill_cents: s.cashBillCents,
    p_cash_tip_cents: s.cashTipCents,
    p_card_bill_cents: s.cardBillCents,
    p_card_tip_cents: s.cardTipCents,
    p_request_id: s.requestId,
    p_proof_token: mintProofToken(),
    p_outside_cashback_bps: Math.max(0, cashBackBps),
    p_max_outside_per_day: OUTSIDE_MAX_PER_DAY,
  };
}

// ── Staff (MESITA-3462's identity) ──────────────────────────────────────────

/** The waiter is staff of the tab's place: a place code (one staff try when
 *  wrong; it mints a 12-hour staff token) or a staff token minted for this
 *  place. Answers the token the waiter's screen keeps from now on. */
export async function tabStaffAccess(
  admin: SupabaseClient,
  args: { serviceKey: string; headers: Headers; placeId: string; key: StaffKeyInput; nowMs: number },
): Promise<{ ok: true; staffToken: string; minted: { token: string; expiresAt: string } | null } | TabRefusal> {
  const res = await staffAccess(supabaseStaffStore(admin), {
    input: { placeId: args.placeId, placeCode: args.key.placeCode, staffToken: args.key.staffToken },
    serviceKey: args.serviceKey,
    staffKey: await staffTryKey(args.serviceKey, clientAddress(args.headers)),
    nowMs: args.nowMs,
  });
  if (!res.ok) return refuse(res.status, res.code, res.error, res.detail);
  const staffToken = res.minted?.token ?? args.key.staffToken;
  if (!staffToken) return refuse(403, "staff_only", "Type the place code");
  return { ok: true, staffToken, minted: res.minted };
}
