// Staff identity on visit.mesita.ai (MESITA-3462) and the staff list of a
// place's Mesita Payments.
//
//   visit-web-list-payments   readListBody → staffAccess → listPayments
//
// Who is staff: whoever knows the place code (place_codes, six digits the
// owner sets on Business › Payments; MESITA-3299). There is no staff sign-in
// and no staff table. Typing the code once answers a staff token, and the
// screen's 15-second reads carry that token, never the code again.
//
// The staff token is stateless: `s1.<expiry unix s>.<HMAC>` (before
// MESITA-3707) or `s2.<expiry>.<qr|code>.<device id>.<HMAC>`, where the HMAC
// (SHA-256, under a key derived from the service role key) covers the place
// id, the expiry and the place's CURRENT code hash. So:
//   - it lasts 12 hours;
//   - it is bound to one place (another place id fails the HMAC);
//   - the owner revokes every staff token of the place by changing the code
//     on Business › Payments (the hash changes, the HMAC no longer matches);
//   - rotating the service role key revokes every staff token everywhere.
// The code hash never leaves the server: the token carries only the HMAC.
//
// The Staff QR (MESITA-3696): the owner prints a QR on Business › Payments,
// visit.mesita.ai/staff/<place>#<secret>, and a waiter who scans it gets the
// same 12-hour token with no code typed (visit-web-join-staff). The secret
// sits on place_codes beside the code hash, and the token's HMAC covers both:
// a new QR or a new code ends every token of the place. A wrong or replaced
// secret is a `staff` try like a wrong code.
//
// The locks are the waiter's charge's (charge.ts): a wrong place code is a
// `staff` try on place_charge_tries keyed by the address HMAC, five per
// (place, address) and 50 per place in ten minutes. A bad token is not a try:
// it is 128+ bits a person cannot guess, and a stale one is a screen left
// open past its 12 hours.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isUuid } from "./place-id.ts";
import { hashPlaceCode, readPlaceCode } from "./place-code.ts";
import { lockedFor, PAIR_TRY_LIMIT, PLACE_STAFF_TRY_LIMIT, TRY_WINDOW_SEC, type TryKind } from "./charge.ts";
import { timingSafeEqual } from "./timing-safe-equal.ts";

export const STAFF_TOKEN_TTL_SEC = 12 * 60 * 60;
/** The list's window: payments paid in the last 12 hours. */
export const LIST_WINDOW_SEC = 12 * 60 * 60;
/** A shift's worth; the list never pages. */
export const LIST_LIMIT = 200;

export type StaffRefusal = { ok: false; status: number; code: string; error: string; detail?: Record<string, unknown> };

function refuse(status: number, code: string, error: string, detail?: Record<string, unknown>): StaffRefusal {
  return { ok: false, status, code, error, ...(detail ? { detail } : {}) };
}

export const STAFF_ONLY = "Only the place's staff can see its payments. Type the place code.";

// ── Reading what arrives ─────────────────────────────────────────────────────

/** Either the place code or the Staff QR's secret (the first read) or the
 *  staff token (every read after). A body with none is a read without staff
 *  access. */
export type ListInput = { placeId: string; placeCode: string | null; staffToken: string | null; staffQr?: string | null };

/** The Staff QR's secret: 32 random bytes, base64url, 43 characters. */
export const STAFF_QR_RE = /^[A-Za-z0-9_-]{43}$/;

export function readStaffQr(v: unknown): string | null {
  return typeof v === "string" && STAFF_QR_RE.test(v) ? v : null;
}

/** A new Staff QR secret. */
export function makeStaffQr(): string {
  return b64url(crypto.getRandomValues(new Uint8Array(32)));
}

export function readListBody(b: Record<string, unknown>): { ok: true; input: ListInput } | StaffRefusal {
  if (!isUuid(b.place_id)) return refuse(400, "bad_request", "place_id must be a Mesita place id");
  const staffToken = typeof b.staff_token === "string" && b.staff_token.length <= 128 ? b.staff_token : null;
  const placeCode = staffToken ? null : readPlaceCode(b.place_code);
  const staffQr = staffToken || placeCode ? null : readStaffQr(b.staff_qr);
  return { ok: true, input: { placeId: b.place_id, placeCode, staffToken, staffQr } };
}

// ── The token ───────────────────────────────────────────────────────────────

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

/** What a place's tokens are signed over: the code hash, and the Staff QR's
 *  secret once there is one. A place with no QR signs exactly what it signed
 *  before MESITA-3696, so its live tokens survive the deploy. */
export type StaffKeys = { codeHash: string; staffQr: string | null };

function signedOver(keys: StaffKeys): string {
  return keys.staffQr ? `${keys.codeHash}:${keys.staffQr}` : keys.codeHash;
}

async function staffMac(serviceKey: string, placeId: string, expSec: number, codeHash: string): Promise<string> {
  const keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`staff-token-key:${serviceKey}`)));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`staff:${placeId}:${expSec}:${codeHash}`));
  return b64url(new Uint8Array(sig));
}

/** How a phone became staff (MESITA-3707): `qr` = it scanned the owner's
 *  Staff QR; `code` = someone typed the place code on it. Only a `qr` token
 *  may Verify a guest's payment or confirm cash: a code can be watched being
 *  typed, a Staff QR is sent to waiters by WhatsApp. */
export type StaffSource = "qr" | "code";

/** What a valid token says. `s1` tokens (before MESITA-3707) carry no source
 *  and no device id; they keep working on the old screens until they expire. */
export type StaffTokenInfo = { version: 1 | 2; src: StaffSource | null; jti: string | null; exp: number };

async function staffMac2(serviceKey: string, placeId: string, expSec: number, src: StaffSource, jti: string, signed: string): Promise<string> {
  const keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`staff-token-key:${serviceKey}`)));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`staff2:${placeId}:${expSec}:${src}:${jti}:${signed}`));
  return b64url(new Uint8Array(sig));
}

/** `s2.<exp>.<src>.<jti>.<mac>`: the source and a per-join random device id
 *  (128 bits) both inside the HMAC, so editing either fails the check and two
 *  phones that join in the same second are two phones. */
export async function mintStaffToken(
  serviceKey: string,
  placeId: string,
  keys: StaffKeys,
  nowMs: number,
  src: StaffSource = "code",
): Promise<{ token: string; expiresAt: string }> {
  const exp = Math.floor(nowMs / 1000) + STAFF_TOKEN_TTL_SEC;
  const jti = b64url(crypto.getRandomValues(new Uint8Array(16)));
  const mac = await staffMac2(serviceKey, placeId, exp, src, jti, signedOver(keys));
  return { token: `s2.${exp}.${src}.${jti}.${mac}`, expiresAt: new Date(exp * 1000).toISOString() };
}

/** The token's facts when it is an unexpired token minted for this place
 *  under its current code hash and Staff QR; null otherwise. No keys (the
 *  owner removed the code) is never valid. */
export async function readStaffToken(
  serviceKey: string,
  placeId: string,
  token: string,
  keys: StaffKeys | null,
  nowMs: number,
): Promise<StaffTokenInfo | null> {
  if (!keys) return null;
  const nowSec = Math.floor(nowMs / 1000);
  // Expired, or claims to outlive any token this server mints.
  const live = (exp: number) => exp > nowSec && exp <= nowSec + STAFF_TOKEN_TTL_SEC + 60;
  const m2 = /^s2\.(\d{10})\.(qr|code)\.([A-Za-z0-9_-]{22})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (m2) {
    const exp = Number(m2[1]);
    const src = m2[2] as StaffSource;
    if (!live(exp)) return null;
    const ok = timingSafeEqual(m2[4], await staffMac2(serviceKey, placeId, exp, src, m2[3], signedOver(keys)));
    return ok ? { version: 2, src, jti: m2[3], exp } : null;
  }
  const m1 = /^s1\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m1) return null;
  const exp = Number(m1[1]);
  if (!live(exp)) return null;
  const ok = timingSafeEqual(m1[2], await staffMac(serviceKey, placeId, exp, signedOver(keys)));
  return ok ? { version: 1, src: null, jti: null, exp } : null;
}

/** True only for a valid token of this place (s1 or s2, any source). */
export async function checkStaffToken(
  serviceKey: string,
  placeId: string,
  token: string,
  keys: StaffKeys | null,
  nowMs: number,
): Promise<boolean> {
  return (await readStaffToken(serviceKey, placeId, token, keys, nowMs)) !== null;
}

/** The hash a guest tab keeps of the phone that verified it: its device id,
 *  never the token. */
export async function staffDeviceHash(jti: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`staff-jti:${jti}`));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ── The store: every read and write, so the rules test without a database ──

export type StaffPaymentRow = {
  id: string;
  amount_cents: number;
  tip_cents: number;
  currency: string;
  /** Null on an outside bill nobody confirmed (it reads Expired). */
  paid_at: string | null;
  updated_at?: string;
  ticket: string | null;
  proof_seen_at: string | null;
  status: string;
  /** The part paid outside Mesita and confirmed by Received (MESITA-3545). */
  outside_cents?: number | null;
};

export interface StaffStore {
  /** The place's current code hash and Staff QR, or null when no code is set. */
  keys(placeId: string): Promise<StaffKeys | null>;
  /** Stamps the Staff QR's last use (Business › Payments shows it). */
  staffQrUsed(placeId: string, atIso: string): Promise<void>;
  tries(placeId: string, kind: TryKind, key: string | null, sinceIso: string, limit: number): Promise<string[]>;
  addTry(placeId: string, kind: TryKind, key: string): Promise<void>;
  /** The place's payments paid since `sinceIso` in this mode, newest first.
   *  paid_at is set exactly when the money arrived (paid, and a later
   *  refund keeps it), so a refunded payment still lists, marked. */
  payments(placeId: string, sinceIso: string, livemode: boolean, limit: number): Promise<StaffPaymentRow[]>;
}

// ── Staff access ────────────────────────────────────────────────────────────

export const STAFF_QR_OFF = "This Staff QR is turned off. Ask the owner for the new one.";

/** Who may read: a valid staff token, or the right place code or Staff QR
 *  (which mint one). Refusals: 409 place_code_required (no code set), 409
 *  locked, 403 staff_only (no key, a wrong code, a bad, stale or revoked
 *  token), 403 staff_qr_off (a replaced or unknown Staff QR). */
export async function staffAccess(
  store: StaffStore,
  args: { input: ListInput; serviceKey: string; staffKey: string; nowMs: number },
): Promise<{ ok: true; minted: { token: string; expiresAt: string } | null } | StaffRefusal> {
  const { input, nowMs } = args;
  const keys = await store.keys(input.placeId);
  if (!keys) return refuse(409, "place_code_required", "Set the waiter code on Business › Payments first");

  if (input.staffToken) {
    if (await checkStaffToken(args.serviceKey, input.placeId, input.staffToken, keys, nowMs)) return { ok: true, minted: null };
    return refuse(403, "staff_only", STAFF_ONLY);
  }
  if (!input.placeCode && !input.staffQr) return refuse(403, "staff_only", STAFF_ONLY);

  const since = new Date(nowMs - TRY_WINDOW_SEC * 1000).toISOString();
  const mine = await store.tries(input.placeId, "staff", args.staffKey, since, PAIR_TRY_LIMIT);
  const placeWide = await store.tries(input.placeId, "staff", null, since, PLACE_STAFF_TRY_LIMIT);
  const wait = Math.max(lockedFor(mine, PAIR_TRY_LIMIT, nowMs), lockedFor(placeWide, PLACE_STAFF_TRY_LIMIT, nowMs));
  if (wait > 0) return refuse(409, "locked", "Too many wrong place codes. Wait a few minutes.", { retry_after_s: wait });

  if (input.staffQr) {
    if (!keys.staffQr || !timingSafeEqual(input.staffQr, keys.staffQr)) {
      await store.addTry(input.placeId, "staff", args.staffKey);
      return refuse(403, "staff_qr_off", STAFF_QR_OFF);
    }
    await store.staffQrUsed(input.placeId, new Date(nowMs).toISOString());
    return { ok: true, minted: await mintStaffToken(args.serviceKey, input.placeId, keys, nowMs, "qr") };
  }

  const typed = await hashPlaceCode(input.placeId, input.placeCode!);
  if (!timingSafeEqual(typed, keys.codeHash)) {
    await store.addTry(input.placeId, "staff", args.staffKey);
    return refuse(403, "staff_only", "That place code is not right");
  }
  return { ok: true, minted: await mintStaffToken(args.serviceKey, input.placeId, keys, nowMs, "code") };
}

// ── The list ────────────────────────────────────────────────────────────────

/** One row as staff read it: what was received and whether a proof was
 *  seen. Never who paid. */
export type StaffPaymentView = {
  id: string;
  amount_cents: number;
  tip_cents: number;
  currency: string;
  paid_at: string;
  ticket: string | null;
  seen: boolean;
  refunded: boolean;
  /** Paid outside Mesita and confirmed by a waiter's Received at paid_at:
   *  the list reads "Outside · Received HH:mm" (MESITA-3545). */
  outside: boolean;
  /** An outside bill nobody confirmed in its 30 minutes (or the guest
   *  cancelled): "Outside · Expired", at the time it closed. */
  expired: boolean;
};

export function staffPaymentView(r: StaffPaymentRow): StaffPaymentView {
  return {
    id: r.id,
    amount_cents: r.amount_cents,
    tip_cents: r.tip_cents,
    currency: r.currency,
    paid_at: r.paid_at ?? r.updated_at ?? "",
    ticket: r.ticket,
    seen: r.proof_seen_at !== null,
    refunded: r.status === "refunded",
    outside: (r.outside_cents ?? 0) > 0,
    expired: r.paid_at === null && (r.outside_cents ?? 0) > 0,
  };
}

export async function listPayments(
  store: StaffStore,
  args: { placeId: string; livemode: boolean; nowMs: number },
): Promise<StaffPaymentView[]> {
  const since = new Date(args.nowMs - LIST_WINDOW_SEC * 1000).toISOString();
  const rows = await store.payments(args.placeId, since, args.livemode, LIST_LIMIT);
  return rows.map(staffPaymentView);
}

// ── The database ────────────────────────────────────────────────────────────

export function supabaseStaffStore(admin: SupabaseClient): StaffStore {
  return {
    async keys(placeId) {
      const { data, error } = await admin.from("place_codes").select("code_hash, staff_qr").eq("place_id", placeId).maybeSingle();
      if (error) throw new Error(`place_code_read: ${error.message}`);
      const row = data as { code_hash: string; staff_qr: string | null } | null;
      return row ? { codeHash: row.code_hash, staffQr: row.staff_qr ?? null } : null;
    },
    async staffQrUsed(placeId, atIso) {
      const { error } = await admin.from("place_codes").update({ staff_qr_used_at: atIso }).eq("place_id", placeId);
      if (error) throw new Error(`staff_qr_used: ${error.message}`);
    },
    async tries(placeId, kind, key, sinceIso, limit) {
      let q = admin
        .from("place_charge_tries")
        .select("tried_at")
        .eq("place_id", placeId)
        .eq("kind", kind)
        .gte("tried_at", sinceIso);
      if (key) q = q.eq("addr_hash", key);
      const { data, error } = await q.order("tried_at", { ascending: false }).limit(limit);
      if (error) throw new Error(`staff_tries: ${error.message}`);
      return ((data ?? []) as Array<{ tried_at: string }>).map((r) => r.tried_at);
    },
    async addTry(placeId, kind, key) {
      const { error } = await admin.from("place_charge_tries").insert({ place_id: placeId, kind, addr_hash: key });
      if (error) throw new Error(`staff_try_write: ${error.message}`);
    },
    async payments(placeId, sinceIso, livemode, limit) {
      // created_at bounds the scan on wallet_payments_place_idx (place_id,
      // created_at desc): a card part's Checkout lives 24 hours at most, so a
      // payment is paid within a day of its creation; 26 hours before the
      // window misses none.
      const createdSince = new Date(Date.parse(sinceIso) - 26 * 60 * 60 * 1000).toISOString();
      const { data, error } = await admin
        .from("wallet_payments")
        .select("id, amount_cents, tip_cents, currency, paid_at, updated_at, ticket, proof_seen_at, status, outside_cents")
        .eq("place_id", placeId)
        .eq("livemode", livemode)
        .gte("created_at", createdSince)
        // Paid in the window, or an outside bill that expired in it (MESITA-3545).
        .or(`paid_at.gte.${sinceIso},and(outside_cents.gt.0,status.eq.expired,updated_at.gte.${sinceIso})`)
        .order("updated_at", { ascending: false })
        .limit(limit);
      if (error) throw new Error(`staff_payments: ${error.message}`);
      return (data ?? []) as StaffPaymentRow[];
    },
  };
}
