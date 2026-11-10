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
// The staff token is stateless: `s1.<expiry unix s>.<HMAC>` where the HMAC
// (SHA-256, under a key derived from the service role key) covers the place
// id, the expiry and the place's CURRENT code hash. So:
//   - it lasts 12 hours;
//   - it is bound to one place (another place id fails the HMAC);
//   - the owner revokes every staff token of the place by changing the code
//     on Business › Payments (the hash changes, the HMAC no longer matches);
//   - rotating the service role key revokes every staff token everywhere.
// The code hash never leaves the server: the token carries only the HMAC.
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

/** Either the place code (the first read) or the staff token (every read
 *  after). A body with neither is a read without staff access. */
export type ListInput = { placeId: string; placeCode: string | null; staffToken: string | null };

export function readListBody(b: Record<string, unknown>): { ok: true; input: ListInput } | StaffRefusal {
  if (!isUuid(b.place_id)) return refuse(400, "bad_request", "place_id must be a Mesita place id");
  const staffToken = typeof b.staff_token === "string" && b.staff_token.length <= 128 ? b.staff_token : null;
  const placeCode = staffToken ? null : readPlaceCode(b.place_code);
  return { ok: true, input: { placeId: b.place_id, placeCode, staffToken } };
}

// ── The token ───────────────────────────────────────────────────────────────

function b64url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function staffMac(serviceKey: string, placeId: string, expSec: number, codeHash: string): Promise<string> {
  const keyBytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`staff-token-key:${serviceKey}`)));
  const key = await crypto.subtle.importKey("raw", keyBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`staff:${placeId}:${expSec}:${codeHash}`));
  return b64url(new Uint8Array(sig));
}

export async function mintStaffToken(serviceKey: string, placeId: string, codeHash: string, nowMs: number): Promise<{ token: string; expiresAt: string }> {
  const exp = Math.floor(nowMs / 1000) + STAFF_TOKEN_TTL_SEC;
  return { token: `s1.${exp}.${await staffMac(serviceKey, placeId, exp, codeHash)}`, expiresAt: new Date(exp * 1000).toISOString() };
}

/** True only for an unexpired token minted for this place under its current
 *  code hash. A null hash (the owner removed the code) is never valid. */
export async function checkStaffToken(
  serviceKey: string,
  placeId: string,
  token: string,
  codeHash: string | null,
  nowMs: number,
): Promise<boolean> {
  if (!codeHash) return false;
  const m = /^s1\.(\d{10})\.([A-Za-z0-9_-]{43})$/.exec(token);
  if (!m) return false;
  const exp = Number(m[1]);
  const nowSec = Math.floor(nowMs / 1000);
  // Expired, or claims to outlive any token this server mints.
  if (exp <= nowSec || exp > nowSec + STAFF_TOKEN_TTL_SEC + 60) return false;
  return timingSafeEqual(m[2], await staffMac(serviceKey, placeId, exp, codeHash));
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
  /** The place's current code hash, or null when no code is set. */
  codeHash(placeId: string): Promise<string | null>;
  tries(placeId: string, kind: TryKind, key: string | null, sinceIso: string, limit: number): Promise<string[]>;
  addTry(placeId: string, kind: TryKind, key: string): Promise<void>;
  /** The place's payments paid since `sinceIso` in this mode, newest first.
   *  paid_at is set exactly when the money arrived (paid, and a later
   *  refund keeps it), so a refunded payment still lists, marked. */
  payments(placeId: string, sinceIso: string, livemode: boolean, limit: number): Promise<StaffPaymentRow[]>;
}

// ── Staff access ────────────────────────────────────────────────────────────

/** Who may read: a valid staff token, or the right place code (which mints
 *  one). Refusals: 409 place_code_required (no code set), 409 locked, 403
 *  staff_only (no key, a wrong code, a bad, stale or revoked token). */
export async function staffAccess(
  store: StaffStore,
  args: { input: ListInput; serviceKey: string; staffKey: string; nowMs: number },
): Promise<{ ok: true; minted: { token: string; expiresAt: string } | null } | StaffRefusal> {
  const { input, nowMs } = args;
  const codeHash = await store.codeHash(input.placeId);
  if (!codeHash) return refuse(409, "place_code_required", "Set the waiter code on Business › Payments first");

  if (input.staffToken) {
    if (await checkStaffToken(args.serviceKey, input.placeId, input.staffToken, codeHash, nowMs)) return { ok: true, minted: null };
    return refuse(403, "staff_only", STAFF_ONLY);
  }
  if (!input.placeCode) return refuse(403, "staff_only", STAFF_ONLY);

  const since = new Date(nowMs - TRY_WINDOW_SEC * 1000).toISOString();
  const mine = await store.tries(input.placeId, "staff", args.staffKey, since, PAIR_TRY_LIMIT);
  const placeWide = await store.tries(input.placeId, "staff", null, since, PLACE_STAFF_TRY_LIMIT);
  const wait = Math.max(lockedFor(mine, PAIR_TRY_LIMIT, nowMs), lockedFor(placeWide, PLACE_STAFF_TRY_LIMIT, nowMs));
  if (wait > 0) return refuse(409, "locked", "Too many wrong place codes. Wait a few minutes.", { retry_after_s: wait });

  const typed = await hashPlaceCode(input.placeId, input.placeCode);
  if (!timingSafeEqual(typed, codeHash)) {
    await store.addTry(input.placeId, "staff", args.staffKey);
    return refuse(403, "staff_only", "That place code is not right");
  }
  return { ok: true, minted: await mintStaffToken(args.serviceKey, input.placeId, codeHash, nowMs) };
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
    async codeHash(placeId) {
      const { data, error } = await admin.from("place_codes").select("code_hash").eq("place_id", placeId).maybeSingle();
      if (error) throw new Error(`place_code_read: ${error.message}`);
      return (data as { code_hash: string } | null)?.code_hash ?? null;
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
