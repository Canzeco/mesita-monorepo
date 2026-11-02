// Wallet — prepaid balances (MESITA-3097).
//
// A guest prepays money at one place; Mesita collects it on its own Stripe
// account (the same keys as Premier, test until Pato flips STRIPE_MODE and
// STRIPE_ALLOW_LIVE) and owes the place. A purchase is one Checkout
// (wallet_purchases); once Stripe says paid, wallet_credit_purchase writes
// its entry (wallet_entries) and the balance is the sum of entries.
//
// No webhook: a purchase is settled when its guest opens the Wallet
// (consumer-web-get-wallet settles every open purchase of theirs first).

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { isAllowedReturnUrl, type StripeCall } from "./boost.ts";
import { isUuid } from "./place-id.ts";

/** Checkout stays open this long (Stripe's minimum is 30 minutes). */
export const WALLET_CHECKOUT_TTL_SEC = 31 * 60;

/** What one prepayment may be, in cents of the place's currency. A currency
 *  not listed here is not sold. */
export const PREPAY_BOUNDS: Record<string, { min: number; max: number }> = {
  mxn: { min: 100_00, max: 10_000_00 },
  usd: { min: 5_00, max: 500_00 },
};

/** The amounts the Prepay sheet offers first. */
export const PREPAY_PRESETS: Record<string, number[]> = {
  mxn: [200_00, 500_00, 1_000_00],
  usd: [10_00, 25_00, 50_00],
};

export type PrepayStart = { placeId: string; amountCents: number; returnUrl: string };

export function parsePrepayStart(body: Record<string, unknown>): { ok: true; start: PrepayStart } | { ok: false; error: string } {
  const placeId = body.place_id;
  if (!isUuid(placeId)) return { ok: false, error: "place_id must be a Mesita place id" };
  const amount = body.amount_cents;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount <= 0) {
    return { ok: false, error: "amount_cents must be a positive whole number" };
  }
  const returnUrl = body.return_url;
  if (typeof returnUrl !== "string" || !isAllowedReturnUrl(returnUrl)) {
    return { ok: false, error: "return_url is not a Mesita address" };
  }
  return { ok: true, start: { placeId, amountCents: amount, returnUrl } };
}

/** The amount checked against the place's currency: whole units, in bounds. */
export function checkPrepayAmount(amountCents: number, currency: string): string | null {
  const bounds = PREPAY_BOUNDS[currency];
  if (!bounds) return "This place doesn't take prepayments yet";
  if (amountCents % 100 !== 0) return "Prepay a whole amount";
  if (amountCents < bounds.min || amountCents > bounds.max) {
    return `Prepay between ${bounds.min / 100} and ${bounds.max / 100} ${currency.toUpperCase()}`;
  }
  return null;
}

export function prepayCheckoutParams(args: {
  customer: string;
  purchaseId: string;
  placeId: string;
  consumerId: string;
  amountCents: number;
  currency: string;
  placeName: string;
  returnUrl: string;
  nowSec: number;
}): Record<string, unknown> {
  const sep = args.returnUrl.includes("?") ? "&" : "?";
  const metadata = {
    mesita_kind: "wallet_prepay",
    purchase_id: args.purchaseId,
    place_id: args.placeId,
    consumer_id: args.consumerId,
    amount_cents: String(args.amountCents),
  };
  return {
    mode: "payment",
    customer: args.customer,
    client_reference_id: args.purchaseId,
    success_url: `${args.returnUrl}${sep}prepay={CHECKOUT_SESSION_ID}`,
    cancel_url: args.returnUrl,
    expires_at: args.nowSec + WALLET_CHECKOUT_TTL_SEC,
    metadata,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: args.currency,
        unit_amount: args.amountCents,
        product_data: { name: `Mesita Prepay · ${args.placeName}`.slice(0, 250) },
      },
    }],
    payment_intent_data: { metadata },
  };
}

export type SettleOutcome = "credited" | "already_paid" | "pending" | "expired" | "mismatch";

/** What a Checkout session says about a purchase. Only `paid` credits; an
 *  open session is left alone; an expired one ends the purchase. A session
 *  whose metadata names another purchase is never trusted. */
export function classifySession(
  session: Record<string, unknown>,
  purchaseId: string,
): { kind: "paid"; paymentIntent: string | null } | { kind: "pending" } | { kind: "expired" } | { kind: "mismatch" } {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (meta.purchase_id !== purchaseId) return { kind: "mismatch" };
  if (session.payment_status === "paid") {
    const pi = session.payment_intent;
    const id = typeof pi === "string" ? pi : (pi && typeof pi === "object" ? String((pi as { id?: unknown }).id ?? "") : "");
    return { kind: "paid", paymentIntent: id || null };
  }
  if (session.status === "expired") return { kind: "expired" };
  return { kind: "pending" };
}

export type OpenPurchase = { id: string; stripe_checkout_session_id: string | null; created_at: string };

/** Settles one open purchase against Stripe. Idempotent: the RPC credits once. */
export async function settlePurchase(
  admin: SupabaseClient,
  stripe: StripeCall,
  purchase: OpenPurchase,
  nowMs: number,
): Promise<SettleOutcome> {
  const sessionId = purchase.stripe_checkout_session_id;
  if (!sessionId) {
    // No session was ever stored: nothing can be paid. Past the Checkout
    // window it is closed so it stops being read.
    if (nowMs - Date.parse(purchase.created_at) > WALLET_CHECKOUT_TTL_SEC * 1000) {
      await expirePurchase(admin, purchase.id);
      return "expired";
    }
    return "pending";
  }
  const session = await stripe("GET", `checkout/sessions/${encodeURIComponent(sessionId)}`);
  const c = classifySession(session, purchase.id);
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
    .eq("status", "open");
  if (error) throw new Error(`wallet_expire: ${error.message}`);
}

export type Entry = {
  place_id: string;
  kind: string;
  amount_cents: number;
  currency: string;
  created_at: string;
};

export type Balance = {
  place_id: string;
  currency: string;
  balance_cents: number;
  last_at: string;
  entries: Array<{ kind: string; amount_cents: number; at: string }>;
};

/** One balance per (place, currency), newest activity first; entries newest
 *  first. A place whose entries sum to zero still shows (its history). */
export function balancesOf(entries: Entry[]): Balance[] {
  const byKey = new Map<string, Balance>();
  for (const e of entries) {
    const key = `${e.place_id}:${e.currency}`;
    let b = byKey.get(key);
    if (!b) {
      b = { place_id: e.place_id, currency: e.currency, balance_cents: 0, last_at: e.created_at, entries: [] };
      byKey.set(key, b);
    }
    b.balance_cents += e.amount_cents;
    if (e.created_at > b.last_at) b.last_at = e.created_at;
    b.entries.push({ kind: e.kind, amount_cents: e.amount_cents, at: e.created_at });
  }
  const out = [...byKey.values()];
  for (const b of out) b.entries.sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0));
  out.sort((x, y) => (x.last_at < y.last_at ? 1 : x.last_at > y.last_at ? -1 : 0));
  return out;
}

// ── Place reads (kept last: the write-surface scan reads 2000 characters
// after a `.from("profiles")`) ─────────────────────────────────────────────

export type PrepayPlace = { id: string; name: string | null; state: string | null; currency: string | null; prepay_enabled: boolean | null };

/** The place a guest prepays at: whether it sells, and in what currency. */
export async function readPrepayPlace(
  admin: SupabaseClient,
  placeId: string,
): Promise<{ ok: true; place: PrepayPlace | null } | { ok: false; error: string }> {
  const { data, error } = await admin
    .from("profiles")
    .select("id, name, state, currency, prepay_enabled")
    .eq("id", placeId)
    .maybeSingle();
  if (error) return { ok: false, error: `place_read: ${error.message}` };
  return { ok: true, place: (data as PrepayPlace | null) ?? null };
}

export type WalletPlace = { id: string; slug: string | null; name: string | null; photo: string | null };

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
    .select("id, slug, name, photos")
    .in("id", ids);
  if (error) return { ok: false, error: `places: ${error.message}` };
  for (const p of (data ?? []) as Array<{ id: string; slug: string | null; name: string | null; photos: string[] | null }>) {
    places.set(p.id, { id: p.id, slug: p.slug, name: p.name, photo: p.photos?.[0] ?? null });
  }
  return { ok: true, places };
}
