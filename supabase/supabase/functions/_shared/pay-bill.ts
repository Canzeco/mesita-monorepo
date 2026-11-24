// Waiter-led pay (MESITA-4823). The guest shows one general QR (and six
// digits under it); the waiter scans it on service.mesita.ai, types the bill and
// the tip and sends; the guest accepts or declines; the rest is paid outside
// Mesita; the waiter's Received spends the credits and grants the cashback.
//
//   consumer-web-get-pay-code  pay_guest_code_set   the QR, and the guest's poll
//   consumer-web-answer-bill   pay_bill_accept | pay_bill_decline | cancel
//   visit-web-sign-in          staffAccess          the waiter code, once per phone per 12 h
//   visit-web-open-bill        pay_bill_open        the scan
//   visit-web-send-bill        pay_bill_send        the bill, or an edit
//   visit-web-get-bill         reads                the waiter's poll
//   visit-web-close-bill       received | cancel
//
// pay_bills is the proposal only. Once accepted, guest_pay_attempts is the
// truth (guest-attempt.ts), and billState derives the state from it.
// The waiter never reads who the guest is, nor their balance: a photo, and the
// credits used only once the guest accepted.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { MAX_PAYMENT_INPUT_CENTS } from "./money.ts";
import { isUuid } from "./place-id.ts";
import { isProofToken, mintProofToken, payCodeUrl } from "./proof.ts";
import { type AttemptRow, readAttemptById } from "./guest-attempt.ts";
import { readStaffToken, staffDeviceHash, supabaseStaffStore, tabStaffJti } from "./staff.ts";
import { PAIR_TRY_LIMIT, TRY_WINDOW_SEC } from "./charge.ts";

/** Minutes the guest has to answer, then the minutes they have to pay. */
export const BILL_ANSWER_MIN = 15;
export const BILL_PAY_MIN = 60;

export type BillStatus = "open" | "sent" | "accepted" | "declined" | "cancelled" | "expired";
/** What both screens read. */
export type BillState = "open" | "sent" | "accepted" | "confirming" | "paid" | "declined" | "cancelled" | "expired";

export type BillQuote = {
  mechanism: "cashback" | "discount";
  line: string;
  discount_bps: number;
  discount_cents: number;
  credit_cents: number;
  outside_bill_cents: number;
  tip_cents: number;
  outside_cents: number;
  cashback_bps: number;
  cashback_cents: number;
  /** The bill reached the ceiling (MESITA-4831). */
  cashback_capped?: boolean;
};

export type BillRow = {
  id: string;
  consumer_id: string;
  place_id: string;
  livemode: boolean;
  currency: string;
  status: BillStatus;
  version: number;
  bill_cents: number | null;
  tip_cents: number;
  quote: BillQuote | null;
  attempt_id: string | null;
  expires_at: string;
  updated_at: string;
};

const BILL_COLUMNS =
  "id, consumer_id, place_id, livemode, currency, status, version, bill_cents, tip_cents, quote, attempt_id, expires_at, updated_at";

type AttemptFacts = Pick<AttemptRow, "status" | "charging_at" | "end_reason" | "expires_at" | "tab_id">;

/** One truth: the bill until Accept, the attempt after. Pure. */
export function billState(b: Pick<BillRow, "status" | "expires_at">, a: AttemptFacts | null, nowMs: number): BillState {
  if (b.status === "accepted") {
    if (!a) return "expired";
    if (a.status === "closed") return "paid";
    if (a.status === "released") return a.end_reason === "expired" ? "expired" : "cancelled";
    if (a.charging_at) return "confirming";
    return Date.parse(a.expires_at) <= nowMs ? "expired" : "accepted";
  }
  if (b.status === "open" || b.status === "sent") return Date.parse(b.expires_at) <= nowMs ? "expired" : b.status;
  return b.status;
}

const view = (b: BillRow, a: AttemptFacts | null, nowMs: number) => ({
  id: b.id,
  state: billState(b, a, nowMs),
  version: b.version,
  currency: b.currency,
  bill_cents: b.bill_cents,
  tip_cents: b.tip_cents,
  expires_at: b.status === "accepted" && a ? a.expires_at : b.expires_at,
  updated_at: b.updated_at,
  test_mode: !b.livemode,
});

/** The guest's read: every number they accept. Pure. */
export function guestBillView(b: BillRow, a: AttemptFacts | null, nowMs: number) {
  return { ...view(b, a, nowMs), quote: b.status === "open" ? null : b.quote, attempt_id: b.attempt_id, tab_id: a?.tab_id ?? null };
}

/** The waiter's read: no credit, no discount and no cashback before the
 *  guest accepts, so a bill is never a way to read a balance. Pure. */
export function staffBillView(b: BillRow, a: AttemptFacts | null, nowMs: number) {
  const q = b.status === "accepted" ? b.quote : null;
  return {
    ...view(b, a, nowMs),
    discount_cents: q?.discount_cents ?? 0,
    credit_cents: q?.credit_cents ?? 0,
    outside_bill_cents: q?.outside_bill_cents ?? null,
    outside_cents: q?.outside_cents ?? null,
  };
}

// ── Keys ────────────────────────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const hashPayCode = (token: string) => sha256Hex(`pay-code:${token}`);
/** Keyed, so a million guesses against a leaked hash need the key too. */
export const hashShortCode = (serviceKey: string, code: string) => sha256Hex(`pay-short:${serviceKey}:${code}`);

/** Six digits without modulo bias. */
export function mintShortCode(): string {
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000;
  let n: number;
  do n = crypto.getRandomValues(new Uint32Array(1))[0]; while (n >= limit);
  return String(n % 1_000_000).padStart(6, "0");
}

export function mintPayCode() {
  const token = mintProofToken();
  return { token, short: mintShortCode(), url: payCodeUrl(token) };
}

// ── Reading what arrives ────────────────────────────────────────────────────

export type OpenBy = { kind: "token"; token: string } | { kind: "short"; code: string } | { kind: "again"; billId: string };

export function readOpenBy(b: Record<string, unknown>): OpenBy | null {
  if (b.again_bill_id !== undefined) return isUuid(b.again_bill_id) ? { kind: "again", billId: b.again_bill_id } : null;
  if (b.token !== undefined) return isProofToken(b.token) ? { kind: "token", token: b.token } : null;
  return typeof b.code === "string" && /^\d{6}$/.test(b.code) ? { kind: "short", code: b.code } : null;
}

export function readCents(v: unknown, min: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= MAX_PAYMENT_INPUT_CENTS ? v : null;
}

// ── Staff ───────────────────────────────────────────────────────────────────

/** A current `s2` token of this place, or null: staff_code_needed. Answers the
 *  phone's hash (kept on the bill for the record). */
export async function billStaff(
  admin: SupabaseClient,
  serviceKey: string,
  body: Record<string, unknown>,
  nowMs: number,
): Promise<{ placeId: string; keyHash: string } | null> {
  const { place_id: placeId, staff_token: token } = body;
  if (!isUuid(placeId) || typeof token !== "string" || token.length === 0 || token.length > 128) return null;
  const keys = await supabaseStaffStore(admin).keys(placeId);
  const jti = tabStaffJti(token, await readStaffToken(serviceKey, placeId, token, keys, nowMs));
  return jti ? { placeId, keyHash: await staffDeviceHash(jti) } : null;
}

/** Wrong six-digit codes: five per phone in ten minutes, on the tries table
 *  the waiter code's locks use. */
export async function shortCodeLocked(admin: SupabaseClient, placeId: string, keyHash: string, nowMs: number): Promise<boolean> {
  const since = new Date(nowMs - TRY_WINDOW_SEC * 1000).toISOString();
  return (await supabaseStaffStore(admin).tries(placeId, "guest", keyHash, since, PAIR_TRY_LIMIT)).length >= PAIR_TRY_LIMIT;
}

// ── The database ────────────────────────────────────────────────────────────

export async function readBill(admin: SupabaseClient, id: string): Promise<BillRow | null> {
  const { data, error } = await admin.from("pay_bills").select(BILL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`pay_bills_read: ${error.message}`);
  return (data as BillRow | null) ?? null;
}

export async function readBillAttempt(admin: SupabaseClient, b: BillRow): Promise<AttemptRow | null> {
  return b.attempt_id ? await readAttemptById(admin, b.attempt_id) : null;
}

/** The bill a guest's screen should show: the newest that is not over. */
export async function readGuestActiveBill(
  admin: SupabaseClient,
  consumerId: string,
  livemode: boolean,
  nowMs: number,
): Promise<{ bill: BillRow; attempt: AttemptRow | null } | null> {
  const { data, error } = await admin.from("pay_bills").select(BILL_COLUMNS)
    .eq("consumer_id", consumerId).eq("livemode", livemode)
    .in("status", ["open", "sent", "accepted"])
    .gte("updated_at", new Date(nowMs - 2 * 60 * 60_000).toISOString())
    .order("updated_at", { ascending: false }).limit(10);
  if (error) throw new Error(`pay_bills_active: ${error.message}`);
  let typing: { bill: BillRow; attempt: AttemptRow | null } | null = null;
  for (const bill of (data ?? []) as BillRow[]) {
    const attempt = await readBillAttempt(admin, bill);
    const s = billState(bill, attempt, nowMs);
    if (s === "sent" || s === "accepted" || s === "confirming") return { bill, attempt };
    if (s === "open") typing ??= { bill, attempt };
  }
  return typing;
}

const REFUSALS: Record<string, [number, string]> = {
  code_gone: [404, "That code expired. Ask the guest to show their QR again."],
  gone: [404, "This bill is gone"],
  forbidden: [403, "This bill is for another place"],
  too_many: [409, "Too many bills for this guest. Wait a while."],
  guest_busy: [409, "This guest has another bill open. Ask them to finish it first."],
  not_over: [409, "This bill is still open"],
  amount_required: [400, "Type the bill"],
  stale: [409, "The bill changed on another phone. Check it and try again."],
  accepted: [409, "The guest already accepted this bill"],
  expired: [409, "This bill expired"],
  cancelled: [409, "This bill was cancelled"],
  declined: [409, "You declined this bill"],
  open: [409, "The waiter is still typing the bill"],
  quote_changed: [409, "The bill changed. Check it again."],
  too_many_open: [409, "You have another bill open. Finish it first."],
  already_final: [409, "This bill is no longer open"],
};

export function billRefusal(r: Record<string, unknown>): { status: number; body: Record<string, unknown> } {
  const code = typeof r.code === "string" ? r.code : "refused";
  const [status, error] = REFUSALS[code] ?? [409, "That did not go through. Try again."];
  const { ok: _ok, ...detail } = r;
  return { status, body: { ...detail, ok: false, code, error } };
}
