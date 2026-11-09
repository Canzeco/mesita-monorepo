// Wallet — the guest's credit at a place (MESITA-3097, on the place's own
// Stripe Connect account since MESITA-3302).
//
// A voucher purchase is one Checkout on the place's connected account
// (wallet_purchases.stripe_account_id), with Mesita's fee as the application
// fee; once Stripe says paid, wallet_credit_purchase writes its voucher and
// bonus entries (wallet_entries), Pending until available_at. The balance is
// wallet_balance(). Settlement has three paths that call the same RPCs: the
// webhook receiver (W2b), the cron (W2b) and this read-time settle, which
// runs when the guest opens the Wallet.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { StripeCall } from "./boost.ts";
import { readCheckoutSession } from "./checkout-session.ts";
import { VOUCHER_CATALOG } from "./money.ts";
import { purchaseStore, settlePurchaseByPaymentIntent } from "./purchase-pi.ts";
import type { MoneyVoucherKey } from "./money-state.ts";

export { classifySession } from "./checkout-session.ts";

/** Checkout stays open this long (Stripe's minimum is 30 minutes). */
export const WALLET_CHECKOUT_TTL_SEC = 31 * 60;

export type SettleOutcome = "credited" | "already_paid" | "pending" | "expired" | "mismatch";

export type OpenPurchase = {
  id: string;
  stripe_checkout_session_id: string | null;
  stripe_account_id: string;
  created_at: string;
  /** The catalog key; null on a legacy prepay. */
  voucher?: string | null;
  /** When the credit turns Available; null credits at once. */
  available_at?: string | null;
  /** A voucher bought with a saved card (MESITA-3552) has a PaymentIntent
   *  and no Checkout session. */
  stripe_payment_intent_id?: string | null;
};

/** When a voucher paid now turns Available: open vouchers an hour after the
 *  charge, Story at once (the catalog's available_after_sec, MESITA-3323). */
export function availableAtFor(voucher: string | null | undefined, nowMs: number): string | null {
  const line = voucher ? VOUCHER_CATALOG[voucher as MoneyVoucherKey] : undefined;
  if (!line || line.available_after_sec <= 0) return null;
  return new Date(nowMs + line.available_after_sec * 1000).toISOString();
}

/** The wallet read's settle-on-read under ONE budget: an AbortController on
 *  the Stripe fetches only (the RPC after a fetch is always awaited), so a
 *  slow Stripe never fails the read and never leaves a half-written credit.
 *  Answers each purchase's outcome and the ids still open when the budget
 *  ran out (`settling`). The receiver and the cron settle those later. */
export async function settleAll(
  admin: SupabaseClient,
  stripe: StripeCall,
  purchases: OpenPurchase[],
  nowMs: number,
  budgetMs: number,
): Promise<{ outcomes: Map<string, SettleOutcome>; settling: string[] }> {
  const outcomes = new Map<string, SettleOutcome>();
  const settling: string[] = [];
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), budgetMs);
  try {
    for (const p of purchases) {
      if (controller.signal.aborted) {
        settling.push(p.id);
        outcomes.set(p.id, "pending");
        continue;
      }
      try {
        const o = await settlePurchase(
          admin,
          stripe,
          { ...p, available_at: p.available_at ?? availableAtFor(p.voucher, nowMs) },
          nowMs,
          { signal: controller.signal },
        );
        outcomes.set(p.id, o);
      } catch (err) {
        // Aborted or failed: the guest sees it as pending; the next read,
        // the receiver or the cron settles it.
        if (!controller.signal.aborted) console.error("[wallet] settle", p.id, String(err));
        settling.push(p.id);
        outcomes.set(p.id, "pending");
      }
    }
  } finally {
    clearTimeout(timer);
  }
  return { outcomes, settling };
}

/** Settles one open purchase against Stripe, on the purchase's own connected
 *  account. Idempotent: the RPC credits once. */
export async function settlePurchase(
  admin: SupabaseClient,
  stripe: StripeCall,
  purchase: OpenPurchase,
  nowMs: number,
  opts?: { signal?: AbortSignal },
): Promise<SettleOutcome> {
  const sessionId = purchase.stripe_checkout_session_id;
  if (!sessionId && purchase.stripe_payment_intent_id && purchase.stripe_account_id) {
    return await settlePurchaseByPaymentIntent(purchaseStore(admin), stripe, {
      id: purchase.id,
      stripe_account_id: purchase.stripe_account_id,
      stripe_payment_intent_id: purchase.stripe_payment_intent_id,
      created_at: purchase.created_at,
      available_at: purchase.available_at ?? null,
    }, nowMs, opts);
  }
  if (!sessionId) {
    // No session was ever stored: nothing can be paid. Past the Checkout
    // window it is closed so it stops being read.
    if (nowMs - Date.parse(purchase.created_at) > WALLET_CHECKOUT_TTL_SEC * 1000) {
      await expirePurchase(admin, purchase.id);
      return "expired";
    }
    return "pending";
  }
  const c = await readCheckoutSession(stripe, sessionId, purchase.id, undefined, {
    stripeAccount: purchase.stripe_account_id,
    signal: opts?.signal,
  });
  if (c.kind === "mismatch") {
    console.error("[wallet] session_mismatch", JSON.stringify({ purchase_id: purchase.id, session_id: sessionId }));
    return "mismatch";
  }
  if (c.kind === "pending") return "pending";
  if (c.kind === "expired") {
    await expirePurchase(admin, purchase.id);
    return "expired";
  }
  const { data, error } = await admin.rpc("wallet_credit_purchase", {
    p_purchase_id: purchase.id,
    p_payment_intent: c.paymentIntent,
    p_available_at: purchase.available_at ?? null,
  });
  if (error) throw new Error(`wallet_credit: ${error.message}`);
  const res = data as { ok?: boolean; outcome?: SettleOutcome; code?: string } | null;
  if (!res?.ok) throw new Error(`wallet_credit: ${res?.code ?? "unknown"}`);
  return res.outcome === "already_paid" ? "already_paid" : "credited";
}

async function expirePurchase(admin: SupabaseClient, id: string): Promise<void> {
  const { error } = await admin
    .from("wallet_purchases")
    .update({ status: "expired", updated_at: new Date().toISOString() })
    .eq("id", id)
    .in("status", ["opening", "open"]);
  if (error) throw new Error(`wallet_expire: ${error.message}`);
}

export type Entry = {
  place_id: string;
  kind: string;
  amount_cents: number;
  currency: string;
  created_at: string;
  /** Pending until this moment; missing reads as Available. */
  available_at?: string | null;
  /** The payment a spend belongs to (MESITA-3304): the Wallet links it to
   *  that payment's proof. */
  payment_id?: string | null;
  /** Who confirmed a cashback's payment (MESITA-3554): wallet_payments.
   *  confirmed_by, joined by the EF for cashback entries only. 'waiter' is
   *  a bill paid in cash at the table. */
  confirmed_by?: "credit" | "stripe" | "waiter" | null;
};

export type Balance = {
  place_id: string;
  currency: string;
  /** Everything, Available and Pending. */
  balance_cents: number;
  available_cents: number;
  pending_cents: number;
  /** What the guest can pay with now (MESITA-3304): Available minus credit
   *  held by open payments, from SQL (wallet_balances), never below zero. */
  spendable_cents: number;
  last_at: string;
  /** `available_at` rides a pending entry only (MESITA-3549): the Wallet's
   *  method sheet counts down to it; an Available entry carries null. */
  entries: Array<{
    kind: string;
    amount_cents: number;
    at: string;
    pending: boolean;
    available_at: string | null;
    payment_id: string | null;
    /** Set on a cashback entry with a payment (MESITA-3554); null otherwise. */
    confirmed_by: "credit" | "stripe" | "waiter" | null;
  }>;
};

/** The key balancesOf and a spendable map share. */
export function balanceKey(placeId: string, currency: string): string {
  return `${placeId}:${currency}`;
}

/** One balance per (place, currency), newest activity first; entries newest
 *  first. A place whose entries sum to zero still shows (its history).
 *  `spendable` comes from SQL keyed by balanceKey; a balance it does not
 *  name can pay nothing (the hold rule lives in SQL only). */
export function balancesOf(
  entries: Entry[],
  nowMs: number = Date.now(),
  spendable: Map<string, number> = new Map(),
): Balance[] {
  const byKey = new Map<string, Balance>();
  for (const e of entries) {
    const key = balanceKey(e.place_id, e.currency);
    let b = byKey.get(key);
    if (!b) {
      b = {
        place_id: e.place_id,
        currency: e.currency,
        balance_cents: 0,
        available_cents: 0,
        pending_cents: 0,
        spendable_cents: Math.max(spendable.get(key) ?? 0, 0),
        last_at: e.created_at,
        entries: [],
      };
      byKey.set(key, b);
    }
    const pending = !!e.available_at && Date.parse(e.available_at) > nowMs;
    b.balance_cents += e.amount_cents;
    if (pending) b.pending_cents += e.amount_cents;
    else b.available_cents += e.amount_cents;
    if (e.created_at > b.last_at) b.last_at = e.created_at;
    b.entries.push({
      kind: e.kind,
      amount_cents: e.amount_cents,
      at: e.created_at,
      pending,
      available_at: pending ? e.available_at ?? null : null,
      payment_id: e.payment_id ?? null,
      confirmed_by: e.kind === "cashback" && e.payment_id ? e.confirmed_by ?? null : null,
    });
  }
  const out = [...byKey.values()];
  for (const b of out) b.entries.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  out.sort((x, y) => (x.last_at < y.last_at ? 1 : x.last_at > y.last_at ? -1 : 0));
  return out;
}

// ── Place reads (kept last: the write-surface scan reads 2000 characters
// after a `.from("profiles")`) ─────────────────────────────────────────────

export type VoucherPlace = {
  id: string;
  name: string | null;
  state: string | null;
  currency: string | null;
  /** The Premier tier, the red mark beside the name on a Pay proof (MESITA-3539). */
  boost_tier?: number | null;
};

/** The place a guest buys a voucher at: its name for the receipt, its state
 *  and its currency. */
export async function readVoucherPlace(
  admin: SupabaseClient,
  placeId: string,
): Promise<{ ok: true; place: VoucherPlace | null } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, state, currency, boost_tier")
    .eq("id", placeId)
    .maybeSingle();
  if (error) return { ok: false, error: `place_read: ${error.message}` };
  return { ok: true, place: (data as VoucherPlace | null) ?? null };
}

/** A Wallet card's place. `boost_tier` is Premier's stored tier (the red
 *  mark); `mesita_pay` (the green mark, moneyState's rule) is added by
 *  consumer-web-get-wallet from the place's switches and account
 *  (MESITA-3514), so the Wallet reads no catalog. */
export type WalletPlace = {
  id: string;
  slug: string | null;
  name: string | null;
  photo: string | null;
  boost_tier: number;
  mesita_pay: boolean;
};

/** The places a guest holds money at. A balance outlives a place's listing,
 *  so the service role reads them, not the guest-visible catalog. */
export async function readWalletPlaces(
  admin: SupabaseClient,
  ids: string[],
): Promise<{ ok: true; places: Map<string, WalletPlace> } | { ok: false; error: string }> {
  const places = new Map<string, WalletPlace>();
  if (ids.length === 0) return { ok: true, places };
  const { data, error } = await admin
    .from("profiles")
    .select("id, slug, name, profile_photo, boost_tier")
    .in("id", ids);
  if (error) return { ok: false, error: `places: ${error.message}` };
  // The round photo is the profile picture (MESITA-3528): the view answers
  // the owner's pick, else the cover.
  // mesita_pay starts false; the EF sets it from the switches it reads.
  for (const p of (data ?? []) as Array<{ id: string; slug: string | null; name: string | null; profile_photo: string | null; boost_tier: number | null }>) {
    places.set(p.id, {
      id: p.id,
      slug: p.slug,
      name: p.name,
      photo: p.profile_photo ?? null,
      boost_tier: typeof p.boost_tier === "number" ? p.boost_tier : 0,
      mesita_pay: false,
    });
  }
  return { ok: true, places };
}
