// Waiter-led pay (MESITA-4823). The guest shows one general QR;
// the waiter scans it on service.mesita.ai, types the bill and
// the tip and sends. THE HANDSHAKE (MESITA-4889): the guest's Pay and the
// waiter's Receive, in any order, on the same version; the second one spends
// the credits and grants the cashback.
//
//   consumer-web-get-pay-code  pay_guest_code_set   the QR, and the guest's poll
//   consumer-web-answer-bill   pay_bill_accept | pay_bill_decline | cancel
//   visit-web-sign-in          waiter_code_try      the waiter code, typed on each bill
//   visit-web-open-bill        pay_bill_open        the scan
//   visit-web-send-bill        pay_bill_send        the bill, or an edit
//   visit-web-get-bill         reads                the waiter's poll
//   visit-web-close-bill       receive | unreceive | cancel
//
// pay_bills is the proposal only. Once accepted, guest_pay_attempts is the
// truth (guest-attempt.ts), and billState derives the state from it.
// The waiter reads the guest's photo and first name (MESITA-4878) and, from the
// moment the bill is sent, what to collect and the credits this bill uses (Pato,
// MESITA-4889: "Build it"): they may tap first. Never the cashback.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { MAX_PAYMENT_INPUT_CENTS } from "./money.ts";
import { isUuid } from "./place-id.ts";
import { isProofToken, mintProofToken, payCodeUrl } from "./proof.ts";
import { type AttemptRow, readAttemptById } from "./guest-attempt.ts";
import { staffDeviceHash } from "./staff.ts";
import { checkWaiterToken, readWaiter, WAITER_TOKEN_MAX, waiterOfToken } from "./waiter-code.ts";

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
  /** The version the waiter tapped Receive on, before the guest paid. */
  received_version: number | null;
  /** What they said they took with it; outlives a change (MESITA-4889). */
  took_cents: number | null;
};

const BILL_COLUMNS =
  "id, consumer_id, place_id, livemode, currency, status, version, bill_cents, tip_cents, quote, attempt_id, expires_at, updated_at, received_version, took_cents";

type AttemptFacts = Pick<AttemptRow, "status" | "charging_at" | "end_reason" | "expires_at" | "tab_id"> & { ending_at?: string | null };

/** One truth: the bill until Accept, the attempt after. Pure. */
export function billState(b: Pick<BillRow, "status" | "expires_at">, a: AttemptFacts | null, nowMs: number): BillState {
  if (b.status === "accepted") {
    if (!a) return "expired";
    if (a.status === "closed") return "paid";
    if (a.status === "released") return a.end_reason === "expired" ? "expired" : "cancelled";
    if (a.charging_at) return "confirming";
    if (a.ending_at) return "cancelled";
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
  waiter_ready: b.status === "sent" && b.received_version === b.version,
  took_cents: b.took_cents,
});

/** The guest's read: every number they accept. Pure. */
export function guestBillView(b: BillRow, a: AttemptFacts | null, nowMs: number) {
  return { ...view(b, a, nowMs), quote: b.status === "open" ? null : b.quote, attempt_id: b.attempt_id, tab_id: a?.tab_id ?? null };
}

/** The waiter's read: what to collect and why, from the moment it is sent
 *  (MESITA-4889). Never the cashback. Pure. */
export function staffBillView(b: BillRow, a: AttemptFacts | null, nowMs: number) {
  const q = b.status === "accepted" || b.status === "sent" ? b.quote : null;
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

export function mintPayCode() {
  const token = mintProofToken();
  return { token, url: payCodeUrl(token) };
}

// ── Reading what arrives ────────────────────────────────────────────────────

export type OpenBy = { kind: "token"; token: string } | { kind: "again"; billId: string };

export function readOpenBy(b: Record<string, unknown>): OpenBy | null {
  if (b.again_bill_id !== undefined) return isUuid(b.again_bill_id) ? { kind: "again", billId: b.again_bill_id } : null;
  return isProofToken(b.token) ? { kind: "token", token: b.token } : null;
}

/** What a waiter code is typed on: the guest's QR, or a bill (MESITA-4833). */
export function readSignInBy(b: Record<string, unknown>): { kind: "token"; token: string } | { kind: "bill"; billId: string } | null {
  if (b.bill_id !== undefined) return isUuid(b.bill_id) ? { kind: "bill", billId: b.bill_id } : null;
  return isProofToken(b.token) ? { kind: "token", token: b.token } : null;
}

export function readCents(v: unknown, min: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= MAX_PAYMENT_INPUT_CENTS ? v : null;
}

// ── Staff ───────────────────────────────────────────────────────────────────

/** The waiter whose current token this is, at this place, or null:
 *  staff_code_needed. Answers the phone's hash (kept on the bill) too. */
export async function billStaff(
  admin: SupabaseClient,
  serviceKey: string,
  body: Record<string, unknown>,
  nowMs: number,
): Promise<{ placeId: string; keyHash: string; waiterId: string; waiterName: string | null } | null> {
  const { place_id: placeId, staff_token: token } = body;
  if (!isUuid(placeId) || typeof token !== "string" || token.length > WAITER_TOKEN_MAX) return null;
  const waiterId = waiterOfToken(token);
  const waiter = waiterId ? await readWaiter(admin, waiterId) : null;
  if (!waiter || waiter.placeId !== placeId) return null;
  const key = await checkWaiterToken(serviceKey, waiter, token, nowMs);
  return key ? { placeId, keyHash: await staffDeviceHash(key.jti), waiterId: waiter.id, waiterName: key.name } : null;
}

// ── The database ────────────────────────────────────────────────────────────

/** What the waiter is typing now (MESITA-4883): display only. */
export const TYPING_STEPS = ["bill", "tip", "code"] as const;
export type Typing = { bill_cents: number; tip_cents: number; step: (typeof TYPING_STEPS)[number] };
/** The waiter's page sends every five seconds at most; past this it stopped. */
export const TYPING_STALE_MS = 15_000;

type DraftRow = { draft_bill_cents: number | null; draft_tip_cents: number | null; draft_step: string | null; draft_at: string | null };
/** Pure. */
export function typingOf(r: DraftRow | null, nowMs: number): Typing | null {
  const step = TYPING_STEPS.find((x) => x === r?.draft_step);
  if (!r?.draft_at || !step || nowMs - Date.parse(r.draft_at) > TYPING_STALE_MS) return null;
  return { bill_cents: r.draft_bill_cents ?? 0, tip_cents: r.draft_tip_cents ?? 0, step };
}

export async function readTyping(admin: SupabaseClient, consumerId: string, nowMs: number): Promise<{ typing: Typing | null; closed: boolean }> {
  const { data, error } = await admin.from("pay_guest_codes").select("draft_bill_cents, draft_tip_cents, draft_step, draft_at, closed_at").eq("consumer_id", consumerId).maybeSingle();
  if (error) throw new Error(`pay_guest_codes_draft: ${error.message}`);
  const row = data as (DraftRow & { closed_at: string | null }) | null;
  return { typing: typingOf(row, nowMs), closed: row?.closed_at != null };
}

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
