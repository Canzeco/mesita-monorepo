// Settling a mixed payment against Stripe (MESITA-3305, W2b): the twin of
// settlePurchase in wallet.ts for wallet_payments. Three callers, one rule:
// the Connect receiver, the cron and consumer-web-get-payment (a read of the
// payment the guest came back to) all read the session on the place's
// connected account and call the same replay-safe RPCs, so two deliveries
// of one event write the spend and the cashback once.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { readCheckoutSession } from "./checkout-session.ts";
import { WALLET_CHECKOUT_TTL_SEC } from "./wallet.ts";
import { type StripeCall, StripeError } from "./stripe.ts";

export type OpenPayment = {
  id: string;
  stripe_checkout_session_id: string | null;
  stripe_account_id: string | null;
  created_at: string;
  expires_at?: string | null;
  /** An in-app card part (Pay at the table, MESITA-3563) has a
   *  PaymentIntent and no Checkout session (MESITA-3568). */
  stripe_payment_intent_id?: string | null;
};

/** How long an in-app PaymentIntent may sit unfinished (a 3-D Secure
 *  challenge the guest left) before the cron cancels it and frees the
 *  credit it held. */
export const PI_TTL_MS = 10 * 60_000;

export type PaymentSettleOutcome = "paid" | "already_paid" | "pending" | "expired" | "mismatch" | "late_completion";

type SettleAnswer = { ok?: boolean; outcome?: string; code?: string } | null;

/** Stripe said paid: the hold becomes the spend, cashback lands at once (MESITA-3909).
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
  if (!sessionId && payment.stripe_payment_intent_id && payment.stripe_account_id) {
    return await settleByPaymentIntent(admin, stripe, payment, nowMs, opts);
  }
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

/** A payment paid inside the app (MESITA-3568): read its PaymentIntent on
 *  the connected account. succeeded → settle; canceled → release; still in
 *  flight → pending for PI_TTL_MS, then cancel it FIRST and release only when
 *  Stripe answers canceled (a PI that succeeded meanwhile settles, never
 *  fails). */
export async function settleByPaymentIntent(
  admin: Pick<SupabaseClient, "rpc">,
  stripe: StripeCall,
  payment: OpenPayment,
  nowMs: number,
  opts?: { signal?: AbortSignal },
): Promise<PaymentSettleOutcome> {
  const piId = payment.stripe_payment_intent_id as string;
  const account = payment.stripe_account_id as string;
  const path = `payment_intents/${encodeURIComponent(piId)}`;
  const pi = await stripe("GET", path, undefined, { stripeAccount: account, signal: opts?.signal });
  const meta = (pi.metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.payment_id === "string" && meta.payment_id !== payment.id) {
    console.error("[settle-payment] pi_mismatch", JSON.stringify({ payment_id: payment.id, payment_intent: piId }));
    return "mismatch";
  }
  const decide = async (status: unknown): Promise<PaymentSettleOutcome | null> => {
    if (status === "succeeded") return await settlePaidPayment(admin, payment.id, piId);
    if (status === "canceled") {
      await releasePayment(admin, payment.id, "failed", "pi_canceled");
      return "expired";
    }
    return null;
  };
  const first = await decide(pi.status);
  if (first) return first;
  if (pi.status === "requires_capture") return await settleHeld(admin, stripe, payment.id, piId, account, opts);
  if (pi.status === "processing" || nowMs - Date.parse(payment.created_at) < PI_TTL_MS) return "pending";

  let after: Record<string, unknown>;
  try {
    after = await stripe("POST", `${path}/cancel`, { cancellation_reason: "abandoned" }, { stripeAccount: account, idempotencyKey: `tabpi-cancel:${payment.id}:${piId}`, signal: opts?.signal });
  } catch (err) {
    // The PI moved under us (it succeeded or is processing): read it again.
    if (!(err instanceof StripeError) || err.httpStatus !== 400) throw err;
    after = await stripe("GET", path, undefined, { stripeAccount: account, signal: opts?.signal });
  }
  return (await decide(after.status)) ?? "pending";
}

// ── MESITA-3856: a guest card held until the waiter signs ──────────────────

export type CaptureOutcome = "paid" | "failed" | "confirming";

/** Captures a held card the waiter signed for. Stripe answers: succeeded →
 *  the settle spends the credit and finishes the signature; a card error or
 *  a hold Stripe already let go → the bill ends, nothing charged; anything
 *  else (a timeout, a 5xx) → confirming, and the next read tries again with
 *  the same idempotency key. */
export async function captureHeldCard(
  admin: Pick<SupabaseClient, "rpc">,
  stripe: StripeCall,
  hold: { tabId: string; paymentId: string; paymentIntent: string; account: string },
  opts?: { signal?: AbortSignal },
): Promise<CaptureOutcome> {
  const path = `payment_intents/${encodeURIComponent(hold.paymentIntent)}`;
  let pi: Record<string, unknown>;
  try {
    pi = await stripe("POST", `${path}/capture`, {}, {
      stripeAccount: hold.account,
      idempotencyKey: `tabcap:${hold.tabId}`,
      signal: opts?.signal,
    });
  } catch (err) {
    if (!(err instanceof StripeError) || (err.httpStatus !== 400 && err.httpStatus !== 402)) {
      console.error("[pay-tab]", JSON.stringify({ tab_id: hold.tabId, to: "signing", reason: "capture_unanswered" }));
      return "confirming";
    }
    try {
      pi = await stripe("GET", path, undefined, { stripeAccount: hold.account, signal: opts?.signal });
    } catch {
      return "confirming";
    }
    if (pi.status !== "succeeded") {
      await failCapture(admin, stripe, hold, err.code || "capture_failed");
      return "failed";
    }
  }
  if (pi.status === "succeeded") {
    await settlePaidPayment(admin, hold.paymentId, hold.paymentIntent);
    console.log("[pay-tab]", JSON.stringify({ tab_id: hold.tabId, from: "signing", to: "paid", reason: "captured" }));
    return "paid";
  }
  if (pi.status === "processing" || pi.status === "requires_capture") return "confirming";
  await failCapture(admin, stripe, hold, `pi_${String(pi.status)}`);
  return "failed";
}

async function failCapture(
  admin: Pick<SupabaseClient, "rpc">,
  stripe: StripeCall,
  hold: { tabId: string; paymentId: string; paymentIntent: string; account: string },
  code: string,
): Promise<void> {
  const { error } = await admin.rpc("pay_tab_capture_failed", { p_tab_id: hold.tabId, p_error: code.slice(0, 64) });
  if (error) throw new Error(`pay_tab_capture_failed: ${error.message}`);
  console.log("[pay-tab]", JSON.stringify({ tab_id: hold.tabId, from: "signing", to: "cancelled", reason: "capture_failed", code }));
  await cancelReleasedHolds(admin, stripe, hold.tabId);
}

/** A held PaymentIntent read by the cron, the webhook or the guest's poll:
 *  the bill decides (wallet_card_held). keep → pending; capture → a
 *  signature is in progress, finish it; cancel → the bill ended, let the
 *  hold go and release the row. */
async function settleHeld(
  admin: Pick<SupabaseClient, "rpc">,
  stripe: StripeCall,
  paymentId: string,
  piId: string,
  account: string,
  opts?: { signal?: AbortSignal },
): Promise<PaymentSettleOutcome> {
  const { data, error } = await admin.rpc("wallet_card_held", { p_payment_id: paymentId });
  if (error) throw new Error(`wallet_card_held: ${error.message}`);
  const d = data as { ok?: boolean; decision?: string; tab_id?: string } | null;
  if (!d?.ok) return "pending";
  if (d.decision === "keep") return "pending";
  if (d.decision === "capture" && d.tab_id) {
    const out = await captureHeldCard(admin, stripe, { tabId: d.tab_id, paymentId, paymentIntent: piId, account }, opts);
    return out === "paid" ? "paid" : out === "failed" ? "expired" : "pending";
  }
  await releasePayment(admin, paymentId, "failed", "hold_released");
  await cancelReleasedHolds(admin, stripe, d.tab_id ?? null);
  return "expired";
}

/** Cancels the Stripe hold of every card part whose bill ended unpaid (X,
 *  Reject, expiry, a failed capture) and stamps it, so a hold never
 *  outlives its bill by more than one cron tick. A Stripe error leaves the
 *  row for the next call. */
export async function cancelReleasedHolds(
  admin: Pick<SupabaseClient, "rpc">,
  stripe: StripeCall,
  tabId: string | null,
): Promise<number> {
  const { data, error } = await admin.rpc("wallet_released_holds", { p_tab_id: tabId, p_limit: 50 });
  if (error) throw new Error(`wallet_released_holds: ${error.message}`);
  let n = 0;
  for (const r of (data ?? []) as Array<{ id: string; stripe_payment_intent_id: string; stripe_account_id: string }>) {
    try {
      await stripe("POST", `payment_intents/${encodeURIComponent(r.stripe_payment_intent_id)}/cancel`, {}, {
        stripeAccount: r.stripe_account_id,
        idempotencyKey: `tabcancel:${r.id}`,
      });
    } catch (err) {
      // Already cancelled (or captured, which the row would show) answers 400.
      if (!(err instanceof StripeError) || err.httpStatus !== 400) {
        console.error("[pay-tab] hold_cancel_failed", JSON.stringify({ payment_id: r.id }));
        continue;
      }
    }
    const done = await admin.rpc("wallet_hold_cancelled", { p_payment_id: r.id });
    if (done.error) throw new Error(`wallet_hold_cancelled: ${done.error.message}`);
    n++;
  }
  return n;
}
