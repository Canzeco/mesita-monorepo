// The waiter's charge (MESITA-3306, W2c): staff open a charge at
// visit.mesita.ai/charge/<place> with the place code and an amount; the guest
// types its 4-digit code on the Pay tab and pays that amount; the staff
// screen polls by the charge token until it reads Paid.
//
//   visit-web-open-charge        readOpenChargeBody → openCharge
//   visit-web-get-charge         getCharge
//   visit-web-confirm-charge     confirmCharge (the waiter's Received on a
//                                bill paid outside, MESITA-3545)
//   consumer-web-start-payment   readChargeCode → findGuestCharge → claim,
//                                pay, bindCharge (the code path)
//
// MESITA-3545 (Payments Flow v2): staff type the tip they asked out loud with
// the bill; the guest's form starts from it and may change it. Once a payment
// binds the charge, the payment's tip is the tip. A guest may pay the bill
// outside Mesita (cash or the place's terminal): the payment opens with an
// outside part and the staff screen shows one Received button; Received is
// the confirmer that makes the 2% cashback (wallet_confirm_outside).
//
// The secrets: the 4-digit code and the 128-bit token are both stored only
// as SHA-256 hashes (place_charges.code_hash, token_hash) and never logged.
// Polling is by token, never by the place code. The place code gate lives on
// open-charge and nowhere else (gate d2): a place with no code answers
// place_code_required.
//
// The locks: a wrong place code is a `staff` try keyed by an HMAC of the
// client address; a wrong charge code is a `guest` try keyed by a hash of the
// guest id. Five in ten minutes per (place, key) and the sixth answers
// locked; 50 staff tries per place in ten minutes is the second line. Guest
// tries never count against staff. A stale token answers gone and writes no
// try.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { MAX_PAYMENT_INPUT_CENTS } from "./money.ts";
import type { MoneyCode } from "./money-codes.ts";
import { isUuid } from "./place-id.ts";
import { hashPlaceCode, readPlaceCode } from "./place-code.ts";
import { isProofToken, mintProofToken } from "./proof.ts";
import { moneyText } from "./pay.ts";

export const CHARGE_TTL_SEC = 10 * 60;
export const TRY_WINDOW_SEC = 10 * 60;
/** Five wrong codes per (place, address or guest); the sixth answers locked. */
export const PAIR_TRY_LIMIT = 5;
/** The per-place ceiling on staff tries in the window: the second line. */
export const PLACE_STAFF_TRY_LIMIT = 50;
export const TICKET_MAX = 32;
/** How many fresh codes to draw when one collides with an open charge. */
const CODE_DRAWS = 12;

export type TryKind = "staff" | "guest";

export type Refusal = { ok: false; status: number; code?: MoneyCode; error: string; detail?: Record<string, unknown> };

function refuse(status: number, error: string, code?: MoneyCode, detail?: Record<string, unknown>): Refusal {
  return { ok: false, status, error, ...(code ? { code } : {}), ...(detail ? { detail } : {}) };
}

// ── Reading what arrives ─────────────────────────────────────────────────────

// deno-lint-ignore no-control-regex
const CONTROL = /[\u0000-\u001f\u007f]/;

/** A ticket: trimmed, at most 32 characters, no control characters; blank
 *  is none. Longer answers ticket_too_long. */
export function readTicket(v: unknown): { ok: true; ticket: string | null } | Refusal {
  if (v === undefined || v === null) return { ok: true, ticket: null };
  if (typeof v !== "string") return refuse(400, "ticket must be text");
  const t = v.trim();
  if (t.length > TICKET_MAX) return refuse(400, `A ticket number is at most ${TICKET_MAX} characters`, "ticket_too_long");
  if (CONTROL.test(t)) return refuse(400, "A ticket number cannot hold control characters");
  return { ok: true, ticket: t === "" ? null : t };
}

export type OpenChargeInput = { placeId: string; placeCode: string; amountCents: number; tipCents: number; ticket: string | null };

/** A tip: absent is 0; a whole number of centavos, 0 to MAX_PAYMENT_INPUT_CENTS,
 *  else tip_invalid. */
export function readTip(v: unknown): { ok: true; tipCents: number } | Refusal {
  if (v === undefined || v === null) return { ok: true, tipCents: 0 };
  if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v > MAX_PAYMENT_INPUT_CENTS) {
    return refuse(400, "Type a tip like 30 or 30.50", "tip_invalid", { cap_cents: MAX_PAYMENT_INPUT_CENTS });
  }
  return { ok: true, tipCents: v };
}

export function readOpenChargeBody(b: Record<string, unknown>): { ok: true; input: OpenChargeInput } | Refusal {
  if (!isUuid(b.place_id)) return refuse(400, "place_id must be a Mesita place id");
  const placeCode = readPlaceCode(b.place_code);
  if (!placeCode) return refuse(400, "The place code is six digits");
  const a = b.amount_cents;
  if (a === undefined || a === null || a === 0) return refuse(400, "Type an amount to charge", "amount_required");
  if (typeof a !== "number" || !Number.isInteger(a)) return refuse(400, "amount_cents must be a whole number of centavos");
  if (a < 0) return refuse(400, "Type an amount to charge", "amount_required");
  if (a > MAX_PAYMENT_INPUT_CENTS) {
    return refuse(400, "That is more than one payment can be", "above_cap", { cap_cents: MAX_PAYMENT_INPUT_CENTS });
  }
  const tip = readTip(b.tip_cents);
  if (!tip.ok) return tip;
  const t = readTicket(b.ticket);
  if (!t.ok) return t;
  return { ok: true, input: { placeId: b.place_id, placeCode, amountCents: a, tipCents: tip.tipCents, ticket: t.ticket } };
}

/** The guest's 4-digit code, or null. Spaces a person typed do not count. */
export function readChargeCode(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const code = v.replace(/\s/g, "");
  return /^\d{4}$/.test(code) ? code : null;
}

/** The charge token is a proof-shaped token: 22 base64url characters. */
export const isChargeToken = isProofToken;

// ── Hashes and draws ────────────────────────────────────────────────────────

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return hex(new Uint8Array(digest));
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The code's hash, bound to the place, under its own prefix. */
export function hashChargeCode(placeId: string, code: string): Promise<string> {
  return sha256Hex(`charge-code:${placeId}:${code}`);
}

export function hashChargeToken(token: string): Promise<string> {
  return sha256Hex(`charge-token:${token}`);
}

/** A guest's try key: never the guest id in clear. */
export function guestTryKey(consumerId: string): Promise<string> {
  return sha256Hex(`charge-guest:${consumerId}`);
}

/** 0000–9999 from the platform CSPRNG (rejection sampling, no modulo bias). */
export function mintChargeCode(): string {
  const buf = new Uint16Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < 60000) return String(buf[0] % 10000).padStart(4, "0");
  }
}

export const mintChargeToken = mintProofToken;

/** The client address as the platform's edge saw it. Probed live on
 *  2026-11-09 (MESITA-3535): Cloudflare sets cf-connecting-ip and refuses a
 *  request that sends its own (error 1000); the Supabase edge overwrites
 *  x-real-ip with the same address; x-forwarded-for arrives exactly as the
 *  client wrote it, nothing appended, so it is never read. */
export function clientAddress(headers: Headers): string {
  return headers.get("cf-connecting-ip")?.trim() || headers.get("x-real-ip")?.trim() || "unknown";
}

/** HMAC-SHA256 of the address under a key derived from the service role
 *  key: the address never lands in clear, and the hash is useless without
 *  the key. */
export async function staffTryKey(serviceKey: string, address: string): Promise<string> {
  const keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`charge-addr-key:${serviceKey}`)));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(address));
  return hex(new Uint8Array(sig));
}

/** Seconds until the window lets one more try through, or 0. Takes the
 *  tries' times newest first. */
export function lockedFor(triedAtNewestFirst: string[], limit: number, nowMs: number): number {
  if (triedAtNewestFirst.length < limit) return 0;
  const until = Date.parse(triedAtNewestFirst[limit - 1]) + TRY_WINDOW_SEC * 1000;
  return until > nowMs ? Math.ceil((until - nowMs) / 1000) : 0;
}

// ── The store: every read and write, so the rules test without a database ──

export type ChargeRow = {
  id: string;
  place_id: string;
  amount_cents: number;
  tip_cents: number;
  currency: string;
  ticket: string | null;
  expires_at: string;
  payment_id: string | null;
  consumer_id: string | null;
  paid_at: string | null;
  livemode?: boolean;
};

export type ChargePayment = {
  id: string;
  place_id: string;
  consumer_id: string | null;
  status: string;
  paid_at: string | null;
  livemode: boolean;
  /** What moves through the ledger: credit + card (+ outside). */
  amount_cents: number;
  credit_cents: number;
  tip_cents: number;
  outside_cents: number;
  expires_at: string | null;
};

export interface ChargeStore {
  /** Tries of this kind at the place in the window, newest first; with a
   *  key, only that key's. At most `limit`. */
  tries(placeId: string, kind: TryKind, key: string | null, sinceIso: string, limit: number): Promise<string[]>;
  addTry(placeId: string, kind: TryKind, key: string): Promise<void>;
  placeHasCode(placeId: string): Promise<boolean>;
  checkPlaceCode(placeId: string, hash: string): Promise<boolean>;
  /** Unpaid, unclaimed, expired charges of the place go, so their codes free. */
  clearExpired(placeId: string, nowIso: string): Promise<void>;
  /** "dup" when the code is taken among the place's open charges. */
  insertCharge(row: {
    place_id: string;
    code_hash: string;
    token_hash: string;
    amount_cents: number;
    tip_cents: number;
    currency: string;
    ticket: string | null;
    expires_at: string;
  }): Promise<"ok" | "dup">;
  chargeByToken(tokenHash: string): Promise<ChargeRow | null>;
  /** The place's unpaid charge under this code, expired or not. */
  chargeByCode(placeId: string, codeHash: string): Promise<ChargeRow | null>;
  payment(paymentId: string): Promise<ChargePayment | null>;
  /** One UPDATE: the charge becomes this guest's unless another holds it
   *  or it is paid. */
  claim(chargeId: string, consumerId: string): Promise<boolean>;
  /** Gives the charge back when the guest's start moved no money. */
  unclaim(chargeId: string, consumerId: string): Promise<void>;
  /** Binds the payment to the charge, and copies the waiter's bill onto the
   *  payment (wallet_payments.charge_amount_cents) so it outlives the sweep.
   *  Compare-and-set: only when the charge holds no payment or this one;
   *  false when another payment holds it. */
  bind(chargeId: string, paymentId: string, paidAt: string | null, chargeAmountCents: number): Promise<boolean>;
  /** The guest cancelled an outside bill: the charge is free again for its
   *  remaining minutes (no payment, no claim). Only the charge this guest
   *  holds under this payment, and only while it is unpaid. */
  unbind(paymentId: string, consumerId: string): Promise<void>;
  /** The waiter's Received: wallet_confirm_outside's answer. */
  confirmOutside(paymentId: string): Promise<Record<string, unknown>>;
}

// ── Staff: open a charge ────────────────────────────────────────────────────

export type OpenedCharge = {
  code: string;
  charge_token: string;
  amount_cents: number;
  tip_cents: number;
  currency: string;
  ticket: string | null;
  expires_at: string;
  server_time: string;
};

export async function openCharge(
  store: ChargeStore,
  args: { input: OpenChargeInput; currency: string; staffKey: string; nowMs: number },
): Promise<{ ok: true; charge: OpenedCharge } | Refusal> {
  const { input, nowMs } = args;
  // The gate (d2): no place code, no waiter's charge.
  if (!(await store.placeHasCode(input.placeId))) {
    return refuse(409, "Set a place code on Business › Settings first", "place_code_required");
  }

  const since = new Date(nowMs - TRY_WINDOW_SEC * 1000).toISOString();
  const mine = await store.tries(input.placeId, "staff", args.staffKey, since, PAIR_TRY_LIMIT);
  const placeWide = await store.tries(input.placeId, "staff", null, since, PLACE_STAFF_TRY_LIMIT);
  const wait = Math.max(lockedFor(mine, PAIR_TRY_LIMIT, nowMs), lockedFor(placeWide, PLACE_STAFF_TRY_LIMIT, nowMs));
  if (wait > 0) return refuse(409, "Too many wrong place codes. Wait a few minutes.", "locked", { retry_after_s: wait });

  if (!(await store.checkPlaceCode(input.placeId, await hashPlaceCode(input.placeId, input.placeCode)))) {
    await store.addTry(input.placeId, "staff", args.staffKey);
    return refuse(403, "That place code is not right", "forbidden");
  }

  const nowIso = new Date(nowMs).toISOString();
  await store.clearExpired(input.placeId, nowIso);
  const expiresAt = new Date(nowMs + CHARGE_TTL_SEC * 1000).toISOString();
  for (let i = 0; i < CODE_DRAWS; i++) {
    const code = mintChargeCode();
    const token = mintChargeToken();
    const res = await store.insertCharge({
      place_id: input.placeId,
      code_hash: await hashChargeCode(input.placeId, code),
      token_hash: await hashChargeToken(token),
      amount_cents: input.amountCents,
      tip_cents: input.tipCents,
      currency: args.currency,
      ticket: input.ticket,
      expires_at: expiresAt,
    });
    if (res === "ok") {
      return {
        ok: true,
        charge: {
          code,
          charge_token: token,
          amount_cents: input.amountCents,
          tip_cents: input.tipCents,
          currency: args.currency,
          ticket: input.ticket,
          expires_at: expiresAt,
          server_time: nowIso,
        },
      };
    }
  }
  throw new Error("open_charge: no free code after every draw");
}

// ── Staff: the screen's poll ────────────────────────────────────────────────

export type ChargeView = {
  state: "open" | "paid";
  /** The waiter's bill. */
  amount_cents: number;
  /** The charge's tip until a payment binds it; the payment's tip after. */
  tip_cents: number;
  /** What moved on Mesita (credit + card) once paid; null before. A card
   *  part the guest lowered reads less than the bill: the rest was paid at
   *  the table. */
  paid_cents: number | null;
  /** While the bound payment is an outside bill waiting for Received. */
  outside: { cents: number; tip_cents: number; expires_at: string | null } | null;
  /** The bound bill was paid outside and confirmed (Received). */
  paid_outside: boolean;
  currency: string;
  ticket: string | null;
  expires_at: string;
  paid_at: string | null;
  server_time: string;
};

const PAID = new Set(["paid", "refunded", "partly_refunded"]);
const RELEASED = new Set(["failed", "expired"]);

/** A charge by its token: open, paid, or null (the door answers 404 gone).
 *  Ten minutes after creation it is gone unless its payment started; then
 *  it follows that payment (an outside bill: its own 30 minutes). Reads
 *  only: never a try. */
export async function getCharge(store: ChargeStore, token: string, nowMs: number): Promise<ChargeView | null> {
  const row = await store.chargeByToken(await hashChargeToken(token));
  if (!row) return null;
  const serverTime = new Date(nowMs).toISOString();
  const p = row.payment_id ? await store.payment(row.payment_id) : null;
  const live = p && !RELEASED.has(p.status) ? p : null;
  const view = (state: "open" | "paid", paidAt: string | null): ChargeView => ({
    state,
    amount_cents: row.amount_cents,
    tip_cents: live ? live.tip_cents : row.tip_cents,
    paid_cents: state === "paid" && live ? live.amount_cents - live.outside_cents : null,
    outside: state === "open" && live && live.outside_cents > 0
      ? { cents: live.outside_cents, tip_cents: live.tip_cents, expires_at: live.expires_at }
      : null,
    paid_outside: state === "paid" && !!live && live.outside_cents > 0,
    currency: row.currency,
    ticket: row.ticket,
    expires_at: row.expires_at,
    paid_at: paidAt,
    server_time: serverTime,
  });
  if (row.paid_at) return view("paid", row.paid_at);
  if (live) {
    if (live.paid_at && PAID.has(live.status)) return view("paid", live.paid_at);
    return view("open", null);
  }
  return Date.parse(row.expires_at) <= nowMs ? null : view("open", null);
}

/** The waiter's Received on the charge's outside bill. Answers what the
 *  staff screen needs; refusals in words staff read: 404 gone (no such
 *  charge), 409 not_outside (nothing paying outside yet, or a card or credit
 *  bill), forbidden (the bill belongs to another place), closed (the guest
 *  cancelled), expired (its 30 minutes passed). */
export async function confirmCharge(
  store: ChargeStore,
  token: string,
): Promise<
  | { ok: true; outcome: "paid" | "already_paid"; payment_id: string; place_id: string; outside_cents: number; cashback_cents: number; paid_at: string }
  | Refusal
> {
  const row = await store.chargeByToken(await hashChargeToken(token));
  if (!row) return refuse(404, "This charge is over. Open a new charge.", "gone");
  const p = row.payment_id ? await store.payment(row.payment_id) : null;
  if (!p || p.outside_cents === 0) return refuse(409, "Not paying outside yet", "not_outside");
  if (p.place_id !== row.place_id) return refuse(409, "This bill belongs to another place", "forbidden");
  const r = await store.confirmOutside(p.id);
  if (r.ok === true) {
    return {
      ok: true,
      outcome: r.outcome === "already_paid" ? "already_paid" : "paid",
      payment_id: p.id,
      place_id: row.place_id,
      outside_cents: Number(r.outside_cents ?? p.outside_cents),
      cashback_cents: Number(r.cashback_cents ?? 0),
      paid_at: String(r.paid_at),
    };
  }
  // Either way nothing was paid from credit: the whole bill is the waiter's
  // to collect.
  const bill = moneyText(Number(r.bill_cents ?? row.amount_cents), row.currency);
  if (r.code === "closed") {
    return refuse(409, `Cancelled by the guest. Collect ${bill}: nothing was paid from credit.`, "closed", { bill_cents: Number(r.bill_cents ?? row.amount_cents) });
  }
  if (r.code === "expired") {
    return refuse(409, `Expired. Collect ${bill}: nothing was paid from credit.`, "expired", { bill_cents: Number(r.bill_cents ?? row.amount_cents) });
  }
  if (r.code === "not_outside") return refuse(409, "Not paying outside yet", "not_outside");
  if (r.code === "not_found") return refuse(404, "This charge is over. Open a new charge.", "gone");
  throw new Error(`confirm_outside: ${String(r.code ?? "unknown")}`);
}

// ── The guest: pay by code ──────────────────────────────────────────────────

/** The charge a guest's code names, ready to pay, or why not. A wrong code
 *  is a guest try; the sixth in ten minutes answers locked. A charge another
 *  guest holds answers taken; one this guest already paid answers taken with
 *  its payment, so the Pay page shows that proof. */
export async function findGuestCharge(
  store: ChargeStore,
  args: { placeId: string; consumerId: string; code: string; nowMs: number },
): Promise<{ ok: true; charge: ChargeRow } | Refusal> {
  const key = await guestTryKey(args.consumerId);
  const since = new Date(args.nowMs - TRY_WINDOW_SEC * 1000).toISOString();
  const wait = lockedFor(await store.tries(args.placeId, "guest", key, since, PAIR_TRY_LIMIT), PAIR_TRY_LIMIT, args.nowMs);
  if (wait > 0) return refuse(409, "Too many wrong codes. Wait a few minutes.", "locked", { retry_after_s: wait });

  const row = await store.chargeByCode(args.placeId, await hashChargeCode(args.placeId, args.code));
  if (!row) {
    await store.addTry(args.placeId, "guest", key);
    return refuse(404, "That code isn't open here. Ask the waiter for it again.", "gone");
  }
  if (row.consumer_id && row.consumer_id !== args.consumerId) {
    return refuse(409, "Someone else is paying this charge", "taken", { payment_id: null });
  }
  if (row.payment_id) {
    const p = await store.payment(row.payment_id);
    if (p && p.paid_at && PAID.has(p.status)) {
      return refuse(409, "This payment already went through", "taken", {
        payment_id: p.consumer_id === args.consumerId ? p.id : null,
      });
    }
    if (p && !RELEASED.has(p.status)) return { ok: true, charge: row };
  }
  if (Date.parse(row.expires_at) <= args.nowMs) {
    return refuse(404, "That code expired. Ask the waiter for a new one.", "gone");
  }
  return { ok: true, charge: row };
}

/** This guest's outside bill on this charge that still waits for Received,
 *  or null: a second "paying the waiter" tap answers it (in_progress), never
 *  a second hold under a new request_id (MESITA-3545). */
export async function openOutsideOf(store: ChargeStore, row: ChargeRow, consumerId: string): Promise<ChargePayment | null> {
  if (!row.payment_id) return null;
  const p = await store.payment(row.payment_id);
  return p && p.consumer_id === consumerId && p.outside_cents > 0 && (p.status === "open" || p.status === "opening") ? p : null;
}

/** What the guest's form shows once the code is right: the amount, locked. */
export function chargeLook(row: ChargeRow) {
  return { amount_cents: row.amount_cents, tip_cents: row.tip_cents, currency: row.currency, ticket: row.ticket, expires_at: row.expires_at };
}

// ── The store on Postgres ───────────────────────────────────────────────────

const CHARGE_COLUMNS = "id, place_id, amount_cents, tip_cents, currency, ticket, expires_at, payment_id, consumer_id, paid_at";

export function supabaseChargeStore(admin: SupabaseClient): ChargeStore {
  return {
    async tries(placeId, kind, key, sinceIso, limit) {
      let q = admin
        .from("place_charge_tries")
        .select("tried_at")
        .eq("place_id", placeId)
        .eq("kind", kind)
        .gte("tried_at", sinceIso);
      if (key) q = q.eq("addr_hash", key);
      const { data, error } = await q.order("tried_at", { ascending: false }).limit(limit);
      if (error) throw new Error(`charge_tries: ${error.message}`);
      return ((data ?? []) as Array<{ tried_at: string }>).map((r) => r.tried_at);
    },
    async addTry(placeId, kind, key) {
      const { error } = await admin.from("place_charge_tries").insert({ place_id: placeId, kind, addr_hash: key });
      if (error) throw new Error(`charge_try_write: ${error.message}`);
    },
    async placeHasCode(placeId) {
      const { data, error } = await admin.from("place_codes").select("place_id").eq("place_id", placeId).maybeSingle();
      if (error) throw new Error(`place_code_read: ${error.message}`);
      return !!data;
    },
    async checkPlaceCode(placeId, hash) {
      const { data, error } = await admin.rpc("place_code_check", { p_place_id: placeId, p_hash: hash });
      if (error) throw new Error(`place_code_check: ${error.message}`);
      return data === true;
    },
    async clearExpired(placeId, nowIso) {
      const { error } = await admin
        .from("place_charges")
        .delete()
        .eq("place_id", placeId)
        .is("paid_at", null)
        .is("payment_id", null)
        .lt("expires_at", nowIso);
      if (error) throw new Error(`charge_clear: ${error.message}`);
    },
    async insertCharge(row) {
      const { error } = await admin.from("place_charges").insert(row);
      if (!error) return "ok";
      if (error.code === "23505") return "dup";
      throw new Error(`charge_write: ${error.message}`);
    },
    async chargeByToken(tokenHash) {
      const { data, error } = await admin.from("place_charges").select(CHARGE_COLUMNS).eq("token_hash", tokenHash).maybeSingle();
      if (error) throw new Error(`charge_read: ${error.message}`);
      return (data as ChargeRow | null) ?? null;
    },
    async chargeByCode(placeId, codeHash) {
      const { data, error } = await admin
        .from("place_charges")
        .select(CHARGE_COLUMNS)
        .eq("place_id", placeId)
        .eq("code_hash", codeHash)
        .is("paid_at", null)
        .maybeSingle();
      if (error) throw new Error(`charge_read: ${error.message}`);
      return (data as ChargeRow | null) ?? null;
    },
    async payment(paymentId) {
      const { data, error } = await admin
        .from("wallet_payments")
        .select("id, place_id, consumer_id, status, paid_at, livemode, amount_cents, credit_cents, tip_cents, outside_cents, expires_at")
        .eq("id", paymentId)
        .maybeSingle();
      if (error) throw new Error(`charge_payment_read: ${error.message}`);
      return (data as ChargePayment | null) ?? null;
    },
    async claim(chargeId, consumerId) {
      const { data, error } = await admin
        .from("place_charges")
        .update({ consumer_id: consumerId })
        .eq("id", chargeId)
        .is("paid_at", null)
        .or(`consumer_id.is.null,consumer_id.eq.${consumerId}`)
        .select("id");
      if (error) throw new Error(`charge_claim: ${error.message}`);
      return ((data ?? []) as unknown[]).length === 1;
    },
    async unclaim(chargeId, consumerId) {
      const { error } = await admin
        .from("place_charges")
        .update({ consumer_id: null })
        .eq("id", chargeId)
        .eq("consumer_id", consumerId)
        .is("payment_id", null);
      if (error) throw new Error(`charge_unclaim: ${error.message}`);
    },
    async bind(chargeId, paymentId, paidAt, chargeAmountCents) {
      const { data, error } = await admin
        .from("place_charges")
        .update({ payment_id: paymentId, ...(paidAt ? { paid_at: paidAt } : {}) })
        .eq("id", chargeId)
        .or(`payment_id.is.null,payment_id.eq.${paymentId}`)
        .select("id");
      if (error) throw new Error(`charge_bind: ${error.message}`);
      if (((data ?? []) as unknown[]).length !== 1) return false;
      const w = await admin.from("wallet_payments").update({ charge_amount_cents: chargeAmountCents }).eq("id", paymentId);
      if (w.error) throw new Error(`charge_bind_bill: ${w.error.message}`);
      return true;
    },
    async unbind(paymentId, consumerId) {
      const { error } = await admin
        .from("place_charges")
        .update({ payment_id: null, consumer_id: null })
        .eq("payment_id", paymentId)
        .eq("consumer_id", consumerId)
        .is("paid_at", null);
      if (error) throw new Error(`charge_unbind: ${error.message}`);
    },
    async confirmOutside(paymentId) {
      const { data, error } = await admin.rpc("wallet_confirm_outside", { p_payment_id: paymentId });
      if (error) throw new Error(`confirm_outside: ${error.message}`);
      return (data ?? {}) as Record<string, unknown>;
    },
  };
}
