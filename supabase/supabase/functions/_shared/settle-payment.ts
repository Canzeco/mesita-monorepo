// Settling a mixed payment against Stripe (MESITA-3305, W2b): the twin of
// settlePurchase in wallet.ts for wallet_payments. Three callers, one rule:
// the Connect receiver, the cron and consumer-web-get-payment (a read of the
// payment the guest came back to) all read the session on the place's
// connected account and call the same replay-safe RPCs, so two deliveries
// of one event write the spend and the cashback once.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { StripeCall } from "./boost.ts";
import { readCheckoutSession } from "./checkout-session.ts";
import { WALLET_CHECKOUT_TTL_SEC } from "./wallet.ts";

export type OpenPayment = {
  id: string;
  stripe_checkout_session_id: string | null;
  stripe_account_id: string | null;
  created_at: string;
  expires_at?: string | null;
};

export type PaymentSettleOutcome = "paid" | "already_paid" | "pending" | "expired" | "mismatch" | "late_completion";

type SettleAnswer = { ok?: boolean; outcome?: string; code?: string } | null;

/** Stripe said paid: the hold becomes the spend, cashback lands in an hour.
 *  Idempotent through the RPC. */
export async function settlePaidPayment(admin: Pick<SupabaseClient, "rpc">, paymentId: string, paymentIntent: string | null): Promise<PaymentSettleOutcome> {
  const { data, error } = await admin.rpc("wallet_settle_payment", { p_payment_id: paymentId, p_payment_intent: paymentIntent });
  if (error) throw new Error(`wallet_settle_payment: ${error.message}`);
  const res = data as SettleAnswer;
  if (!res?.ok) throw new Error(`wallet_settle_payment: ${res?.code ?? "unknown"}`);
  if (res.outcome === "already_paid") return "already_paid";
  if (res.outcome === "late_completion") return "late_completion";
  return "paid";
}

/** Stripe said the Checkout expired (or it never got a session): the hold
 *  is released, nothing is written. */
export async function releasePayment(admin: Pick<SupabaseClient, "rpc">, paymentId: string, status: "expired" | "failed", error?: string): Promise<void> {
  const { error: err } = await admin.rpc("wallet_release_payment", { p_payment_id: paymentId, p_status: status, p_error: error ?? null });
  if (err) throw new Error(`wallet_release_payment: ${err.message}`);
}

/** Reads the payment's own session on its connected account and settles
 *  what it says. A row with no session and no account cannot be paid: past
 *  the Checkout window it is closed so it stops being read. */
export async function settlePayment(
  admin: Pick<SupabaseClient, "rpc">,
  stripe: StripeCall,
  payment: OpenPayment,
  nowMs: number,
  opts?: { signal?: AbortSignal },
): Promise<PaymentSettleOutcome> {
  const sessionId = payment.stripe_checkout_session_id;
  if (!sessionId || !payment.stripe_account_id) {
    const ttl = payment.expires_at ? Date.parse(payment.expires_at) : Date.parse(payment.created_at) + WALLET_CHECKOUT_TTL_SEC * 1000;
    if (nowMs > ttl) {
      await releasePayment(admin, payment.id, "failed", "no_session");
      return "expired";
    }
    return "pending";
  }
  const c = await readCheckoutSession(stripe, sessionId, payment.id, undefined, {
    stripeAccount: payment.stripe_account_id,
    signal: opts?.signal,
    idKey: "payment_id",
  });
  if (c.kind === "mismatch") {
    console.error("[settle-payment] session_mismatch", JSON.stringify({ payment_id: payment.id, session_id: sessionId }));
    return "mismatch";
  }
  if (c.kind === "pending") return "pending";
  if (c.kind === "expired") {
    await releasePayment(admin, payment.id, "expired");
    return "expired";
  }
  return await settlePaidPayment(admin, payment.id, c.paymentIntent);
}
