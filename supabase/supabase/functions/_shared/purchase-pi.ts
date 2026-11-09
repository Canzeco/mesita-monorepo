// A voucher bought with a saved card (MESITA-3552) is a PaymentIntent on the
// place's connected account, not a Checkout: this file is how its ledger row
// (wallet_purchases) is read, opened, released and credited, and how the
// three settle paths (the Connect receiver, the cron, the Wallet read) settle
// it by its PaymentIntent. The credit itself is wallet_credit_purchase, the
// same RPC the Checkout path calls, so the voucher and its bonus land exactly
// as they do there.
//
// No new SQL: wallet_purchases already has stripe_payment_intent_id (unique).
// Opening names the PI with a guarded update (opening → open, only while no
// PI and no session are stored); releasing is a guarded update (opening/open
// → failed), so a row Stripe already paid is never failed.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type StripeCall, StripeError } from "./boost.ts";

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
};

const COLUMNS =
  "id, status, consumer_id, place_id, voucher, amount_cents, bonus_cents, stripe_account_id, stripe_checkout_session_id, stripe_payment_intent_id, created_at";

/** The purchase row's writes, behind one seam so the money tests can fake it. */
export type PurchaseStore = {
  read(id: string): Promise<PurchaseCardRow | null>;
  /** opening → open naming the PI; true when the row names this PI now
   *  (also when a twin request already stored the same one). */
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
  return {
    read,
    async openPi(id, pi) {
      const { data, error } = await admin.from("wallet_purchases")
        .update({ status: "open", stripe_payment_intent_id: pi, updated_at: new Date().toISOString() })
        .eq("id", id).eq("status", "opening")
        .is("stripe_payment_intent_id", null).is("stripe_checkout_session_id", null)
        .select("id");
      if (error) {
        console.error("[purchase-pi] open_pi", JSON.stringify({ purchase_id: id, error: error.message }));
        return false;
      }
      if ((data ?? []).length > 0) return true;
      const row = await read(id);
      return row?.stripe_payment_intent_id === pi;
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
  purchase: { id: string; stripe_account_id: string; stripe_payment_intent_id: string; created_at: string; available_at: string | null },
  nowMs: number,
  opts?: { signal?: AbortSignal },
): Promise<PurchasePiOutcome> {
  const piId = purchase.stripe_payment_intent_id;
  const account = purchase.stripe_account_id;
  const path = `payment_intents/${encodeURIComponent(piId)}`;
  const pi = await stripe("GET", path, undefined, { stripeAccount: account, signal: opts?.signal });
  const meta = (pi.metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.purchase_id === "string" && meta.purchase_id !== purchase.id) {
    console.error("[purchase-pi] pi_mismatch", JSON.stringify({ purchase_id: purchase.id, payment_intent: piId }));
    return "mismatch";
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
