// A voucher bought with a saved card (MESITA-3552) is a PaymentIntent on the
// place's connected account, not a Checkout: this file is how its ledger row
// (wallet_purchases) is read, opened, released and credited, and how the
// three settle paths (the Connect receiver, the cron, the Wallet read) settle
// it by its PaymentIntent. The credit itself is wallet_credit_purchase, the
// same RPC the Checkout path calls, so the voucher and its bonus land exactly
// as they do there.
//
// wallet_purchases.stripe_payment_intent_id is unique among single purchases
// and basket leads (MESITA-3841 shares it with a lead's followers).
// Opening names the PI with a guarded update (opening → open, only while no
// PI and no session are stored); releasing is a guarded update (opening/open
// → failed), so a row Stripe already paid is never failed.
//
// A BASKET (MESITA-3841) is several vouchers on ONE PaymentIntent: one row
// per voucher unit, the first the lead (it carries the tap's request_id and
// is metadata.purchase_id), the others followers (basket_lead_id = the
// lead). openPi names the PI on the lead and every follower at once; each
// row then credits or releases itself, so the settle paths read a follower
// exactly as a lead (its PI's purchase_id is its lead's, not a mismatch).
// What Stripe says is gone from the shared charge is spread over the rows in
// one fixed order (spreadGone), the receiver and the refund doors alike.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type StripeCall, StripeError } from "./stripe.ts";

/** How long an in-app voucher PaymentIntent may sit unfinished (a 3-D
 *  Secure check the guest left) before it is cancelled and the row
 *  released. The same ten minutes as the bill's card part (PI_TTL_MS). */
export const PURCHASE_PI_TTL_MS = 10 * 60_000;

export type PurchaseCardRow = {
  id: string;
  status: string;
  consumer_id: string | null;
  place_id: string;
  voucher: string | null;
  amount_cents: number;
  bonus_cents: number;
  stripe_account_id: string | null;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  created_at: string;
  /** MESITA-3841: the basket's lead on a follower; null on a lead or a
   *  single purchase (absent on an older read). */
  basket_lead_id?: string | null;
};

const COLUMNS =
  "id, status, consumer_id, place_id, voucher, amount_cents, bonus_cents, stripe_account_id, stripe_checkout_session_id, stripe_payment_intent_id, created_at, basket_lead_id";

/** The purchase row's writes, behind one seam so the money tests can fake it. */
export type PurchaseStore = {
  read(id: string): Promise<PurchaseCardRow | null>;
  /** A basket lead's followers (MESITA-3841), oldest first; [] on a single
   *  purchase. */
  followers(leadId: string): Promise<PurchaseCardRow[]>;
  /** opening → open naming the PI, on the row and on every follower of it
   *  in one write; true when they all name this PI now (also when a twin
   *  request already stored the same one). */
  openPi(id: string, pi: string): Promise<boolean>;
  /** opening/open → failed with the code; a paid row is left alone. */
  release(id: string, code: string): Promise<void>;
  /** Stripe said succeeded: the voucher and its bonus, once. */
  credit(id: string, pi: string, availableAt: string | null): Promise<"credited" | "already_paid">;
};

export function purchaseStore(admin: SupabaseClient): PurchaseStore {
  const read = async (id: string): Promise<PurchaseCardRow | null> => {
    const { data, error } = await admin.from("wallet_purchases").select(COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new Error(`purchase_read: ${error.message}`);
    return (data as PurchaseCardRow | null) ?? null;
  };
  const followers = async (leadId: string): Promise<PurchaseCardRow[]> => {
    const { data, error } = await admin.from("wallet_purchases").select(COLUMNS).eq("basket_lead_id", leadId)
      .order("created_at", { ascending: true }).order("id", { ascending: true });
    if (error) throw new Error(`purchase_followers: ${error.message}`);
    return Array.isArray(data) ? (data as PurchaseCardRow[]) : [];
  };
  return {
    read,
    followers,
    async openPi(id, pi) {
      // The lead and its followers in ONE statement: the follower's
      // PaymentIntent key onto its lead is checked at its end.
      const { error } = await admin.from("wallet_purchases")
        .update({ status: "open", stripe_payment_intent_id: pi, updated_at: new Date().toISOString() })
        .or(`id.eq.${id},basket_lead_id.eq.${id}`).eq("status", "opening")
        .is("stripe_payment_intent_id", null).is("stripe_checkout_session_id", null)
        .select("id");
      if (error) {
        console.error("[purchase-pi] open_pi", JSON.stringify({ purchase_id: id, error: error.message }));
        return false;
      }
      const [row, rest] = await Promise.all([read(id), followers(id)]);
      return row?.stripe_payment_intent_id === pi && rest.every((f) => f.stripe_payment_intent_id === pi);
    },
    async release(id, code) {
      const { error } = await admin.from("wallet_purchases")
        .update({ status: "failed", stripe_error: code.slice(0, 64), updated_at: new Date().toISOString() })
        .eq("id", id).in("status", ["opening", "open"]);
      if (error) throw new Error(`purchase_release: ${error.message}`);
    },
    async credit(id, pi, availableAt) {
      const { data, error } = await admin.rpc("wallet_credit_purchase", {
        p_purchase_id: id,
        p_payment_intent: pi,
        p_available_at: availableAt,
      });
      if (error) throw new Error(`wallet_credit_purchase: ${error.message}`);
      const res = data as { ok?: boolean; outcome?: string; code?: string } | null;
      if (!res?.ok) throw new Error(`wallet_credit_purchase: ${res?.code ?? "unknown"}`);
      return res.outcome === "already_paid" ? "already_paid" : "credited";
    },
  };
}

export type PurchasePiOutcome = "credited" | "already_paid" | "pending" | "expired" | "mismatch";

/** Settles one purchase paid inside the app by reading its PaymentIntent on
 *  the connected account. succeeded → credit; canceled → release; still in
 *  flight → pending for PURCHASE_PI_TTL_MS, then cancel it FIRST and release
 *  only when Stripe answers canceled (a PI that succeeded meanwhile is
 *  credited, never failed). Replay-safe: the credit RPC writes once. */
export async function settlePurchaseByPaymentIntent(
  store: PurchaseStore,
  stripe: StripeCall,
  purchase: {
    id: string;
    stripe_account_id: string;
    stripe_payment_intent_id: string;
    created_at: string;
    available_at: string | null;
    /** MESITA-3841: when known; otherwise read on a purchase_id that is not this row's. */
    basket_lead_id?: string | null;
  },
  nowMs: number,
  opts?: { signal?: AbortSignal },
): Promise<PurchasePiOutcome> {
  const piId = purchase.stripe_payment_intent_id;
  const account = purchase.stripe_account_id;
  const path = `payment_intents/${encodeURIComponent(piId)}`;
  const pi = await stripe("GET", path, undefined, { stripeAccount: account, signal: opts?.signal });
  const meta = (pi.metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.purchase_id === "string" && meta.purchase_id !== purchase.id) {
    // A basket's follower (MESITA-3841): its PI names the lead.
    const lead = purchase.basket_lead_id !== undefined ? purchase.basket_lead_id : (await store.read(purchase.id))?.basket_lead_id ?? null;
    if (lead !== meta.purchase_id) {
      console.error("[purchase-pi] pi_mismatch", JSON.stringify({ purchase_id: purchase.id, payment_intent: piId }));
      return "mismatch";
    }
  }
  const decide = async (status: unknown): Promise<PurchasePiOutcome | null> => {
    if (status === "succeeded") return await store.credit(purchase.id, piId, purchase.available_at);
    if (status === "canceled") {
      await store.release(purchase.id, "pi_canceled");
      return "expired";
    }
    return null;
  };
  const first = await decide(pi.status);
  if (first) return first;
  if (pi.status === "processing" || nowMs - Date.parse(purchase.created_at) < PURCHASE_PI_TTL_MS) return "pending";

  let after: Record<string, unknown>;
  try {
    after = await stripe("POST", `${path}/cancel`, { cancellation_reason: "abandoned" }, {
      stripeAccount: account,
      idempotencyKey: `vouchercard-cancel:${purchase.id}:${piId}`,
      signal: opts?.signal,
    });
  } catch (err) {
    // The PI moved under us (it succeeded or is processing): read it again.
    if (!(err instanceof StripeError) || err.httpStatus !== 400) throw err;
    after = await stripe("GET", path, undefined, { stripeAccount: account, signal: opts?.signal });
  }
  return (await decide(after.status)) ?? "pending";
}

// ── A basket's shared charge (MESITA-3841) ─────────────────────────────────

/** The rows one PaymentIntent pays, in the ONE order every refund path
 *  spreads over: created_at, then id (the lead is written first). A single
 *  purchase is one row. */
export async function purchasesByPaymentIntent<T extends { id: string; amount_cents: number }>(
  admin: SupabaseClient,
  pi: string,
  columns = "id, amount_cents",
): Promise<T[]> {
  const { data, error } = await admin.from("wallet_purchases").select(columns).eq("stripe_payment_intent_id", pi)
    .order("created_at", { ascending: true }).order("id", { ascending: true });
  if (error) throw new Error(`purchases_read: ${error.message}`);
  return Array.isArray(data) ? (data as unknown as T[]) : [];
}

/** Stripe's cumulative amount gone from a shared charge, as each row's
 *  cumulative share: in order, row i takes min(its amount, what is left).
 *  Pure, and a function of `goneCents` alone, so the receiver and a refund
 *  door that land in either order agree (the refund RPC only moves up). */
export function spreadGone(rows: Array<{ id: string; amount_cents: number }>, goneCents: number): Array<{ id: string; cents: number }> {
  let left = Math.max(0, goneCents);
  return rows.map((r) => {
    const cents = Math.min(r.amount_cents, left);
    left -= cents;
    return { id: r.id, cents };
  });
}
