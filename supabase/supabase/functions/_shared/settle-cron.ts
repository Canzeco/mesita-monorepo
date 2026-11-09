// The settle cron's tick (MESITA-3305, W2b): the bounded backstop behind the
// Connect receiver. Every 5 minutes supabase-cron-settle-wallet runs ONE
// tick of this: a batch of rows still open (wallet_settle_batch hands them
// out oldest first, `for update skip locked`, settle_tries bumped), each
// read on its connected account and settled through the same RPCs the
// receiver and the wallet read use.
//
// Bounds, from app_config.money_config with these defaults (rule 9):
//   settle_rows          50 per kind per tick
//   settle_concurrency   5 rows in flight
//   settle_deadline_ms   45 000: no row starts past it
//   settle_give_up_ticks 48 (4 hours): then needs_review with the last
//                        Stripe code; a Stripe 404 gives up at once
//   an `opening` row older than 10 minutes never got its Checkout: failed
//   a payment with a PaymentIntent and no session (an in-app card part,
//     MESITA-3568) is read by its PI: succeeded settles; unfinished after
//     10 minutes is cancelled first, released only when Stripe says
//     canceled; a purchase paid with a saved card (MESITA-3552) the same
//   a stored expires_at in the past that Stripe reports expired: settled
//     once (released) and not re-read
//   paid waiter's charges are deleted 24 h after paid_at, expired unpaid
//     ones on the same tick (place_charges_sweep)
//   each tick logs the needs_review count with console.error
//   Pending credit that turned Available writes one Me › Notifications row
//     per guest, place and ready time (wallet_notify_ready_credit,
//     MESITA-3293), best-effort: a failure is logged, never fails the tick

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { type StripeCall, StripeError } from "./boost.ts";
import { settlePayment } from "./settle-payment.ts";
import { availableAtFor, type OpenPurchase, settlePurchase } from "./wallet.ts";

export type SettleConfig = {
  settle_rows: number;
  settle_concurrency: number;
  settle_deadline_ms: number;
  settle_give_up_ticks: number;
};

export const SETTLE_DEFAULTS: SettleConfig = {
  settle_rows: 50,
  settle_concurrency: 5,
  settle_deadline_ms: 45_000,
  settle_give_up_ticks: 48,
};

/** An `opening` row this old never got its Checkout: the start died
 *  between the hold and Stripe's answer. */
export const OPENING_STALE_MS = 10 * 60_000;

/** The bounds, from the money section's blob; a missing or bad key reads as
 *  its default, never as zero. */
export function settleConfigFrom(raw: unknown): SettleConfig {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const pick = (k: keyof SettleConfig) => {
    const v = o[k];
    return typeof v === "number" && Number.isInteger(v) && v > 0 ? v : SETTLE_DEFAULTS[k];
  };
  return {
    settle_rows: pick("settle_rows"),
    settle_concurrency: pick("settle_concurrency"),
    settle_deadline_ms: pick("settle_deadline_ms"),
    settle_give_up_ticks: pick("settle_give_up_ticks"),
  };
}

export type BatchRow = {
  kind: "purchase" | "payment";
  id: string;
  consumer_id: string | null;
  place_id: string;
  stripe_checkout_session_id: string | null;
  stripe_account_id: string | null;
  created_at: string;
  expires_at: string | null;
  /** After this tick's bump. */
  settle_tries: number;
  status: string;
  voucher: string | null;
  livemode: boolean;
};

export type RowOutcome =
  | "paid"
  | "credited"
  | "already_paid"
  | "pending"
  | "expired"
  | "mismatch"
  | "late_completion"
  | "failed_stale"
  | "needs_review"
  | "skipped_deadline"
  | "error";

export type TickReport = {
  rows: number;
  outcomes: Record<RowOutcome, number>;
  needs_review_total: number;
  charges_swept: number;
  /** credit_ready notifications written this tick (MESITA-3293). */
  credit_ready_notified: number;
  ms: number;
};

export type TickDeps = {
  admin: SupabaseClient;
  stripe: StripeCall;
  livemode: boolean;
  now: () => number;
};

/** One row's fate. Exported for the tests; the tick runs it under the
 *  concurrency and the deadline. */
export async function settleRow(deps: TickDeps, cfg: SettleConfig, row: BatchRow): Promise<RowOutcome> {
  const { admin, stripe } = deps;
  const nowMs = deps.now();
  // A row from the other universe cannot be read with this key.
  if (row.livemode !== deps.livemode) return "pending";

  if (row.status === "opening" && nowMs - Date.parse(row.created_at) > OPENING_STALE_MS) {
    if (row.kind === "payment") {
      const { error } = await admin.rpc("wallet_release_payment", { p_payment_id: row.id, p_status: "failed", p_error: "no_session" });
      if (error) throw new Error(`wallet_release_payment: ${error.message}`);
    } else {
      const { error } = await admin
        .from("wallet_purchases")
        .update({ status: "failed", stripe_error: "no_session", updated_at: new Date(nowMs).toISOString() })
        .eq("id", row.id)
        .eq("status", "opening");
      if (error) throw new Error(`purchase_fail: ${error.message}`);
    }
    return "failed_stale";
  }

  if (row.settle_tries > cfg.settle_give_up_ticks) {
    await giveUp(admin, row, "give_up");
    return "needs_review";
  }

  try {
    if (row.kind === "payment") {
      // A payment with no Checkout session may be an in-app card part
      // (MESITA-3568): the batch does not carry its PaymentIntent, one read
      // does.
      let pi: string | null = null;
      if (!row.stripe_checkout_session_id) {
        const { data, error } = await admin.from("wallet_payments").select("stripe_payment_intent_id").eq("id", row.id).maybeSingle();
        if (error) throw new Error(`payment_pi_read: ${error.message}`);
        pi = (data as { stripe_payment_intent_id: string | null } | null)?.stripe_payment_intent_id ?? null;
      }
      return await settlePayment(admin, stripe, {
        id: row.id,
        stripe_checkout_session_id: row.stripe_checkout_session_id,
        stripe_account_id: row.stripe_account_id,
        created_at: row.created_at,
        expires_at: row.expires_at,
        stripe_payment_intent_id: pi,
      }, nowMs);
    }
    // A purchase with no Checkout session may be a voucher bought with a
    // saved card (MESITA-3552): one read gives its PaymentIntent.
    let purchasePi: string | null = null;
    if (!row.stripe_checkout_session_id) {
      const { data, error } = await admin.from("wallet_purchases").select("stripe_payment_intent_id").eq("id", row.id).maybeSingle();
      if (error) throw new Error(`purchase_pi_read: ${error.message}`);
      purchasePi = (data as { stripe_payment_intent_id: string | null } | null)?.stripe_payment_intent_id ?? null;
    }
    const purchase: OpenPurchase = {
      id: row.id,
      stripe_checkout_session_id: row.stripe_checkout_session_id,
      stripe_account_id: row.stripe_account_id ?? "",
      created_at: row.created_at,
      voucher: row.voucher,
      available_at: availableAtFor(row.voucher, nowMs),
      stripe_payment_intent_id: purchasePi,
    };
    return await settlePurchase(admin, stripe, purchase, nowMs);
  } catch (err) {
    // Stripe does not know the session: nothing will ever settle it.
    if (err instanceof StripeError && err.httpStatus === 404) {
      await giveUp(admin, row, err.code || "resource_missing");
      return "needs_review";
    }
    throw err;
  }
}

async function giveUp(admin: SupabaseClient, row: BatchRow, error: string): Promise<void> {
  const { error: err } = await admin.rpc("wallet_give_up", { p_kind: row.kind, p_row_id: row.id, p_error: error });
  if (err) throw new Error(`wallet_give_up: ${err.message}`);
}

/** The tick: one batch, `concurrency` rows in flight, nothing started past
 *  the deadline; a row that throws counts as `error` and stays open for the
 *  next tick (its settle_tries already counted this one). */
export async function runSettleTick(deps: TickDeps, cfg: SettleConfig): Promise<TickReport> {
  const started = deps.now();
  const outcomes = Object.fromEntries(
    (["paid", "credited", "already_paid", "pending", "expired", "mismatch", "late_completion", "failed_stale", "needs_review", "skipped_deadline", "error"] as RowOutcome[])
      .map((k) => [k, 0]),
  ) as Record<RowOutcome, number>;

  const { data, error } = await deps.admin.rpc("wallet_settle_batch", { p_limit: cfg.settle_rows });
  if (error) throw new Error(`wallet_settle_batch: ${error.message}`);
  const rows = (data ?? []) as BatchRow[];

  let next = 0;
  const worker = async () => {
    while (next < rows.length) {
      const row = rows[next++];
      if (deps.now() - started > cfg.settle_deadline_ms) {
        outcomes.skipped_deadline++;
        continue;
      }
      try {
        outcomes[await settleRow(deps, cfg, row)]++;
      } catch (err) {
        outcomes.error++;
        console.error("[settle-cron] row", JSON.stringify({ kind: row.kind, id: row.id, error: err instanceof Error ? err.message : String(err) }));
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(cfg.settle_concurrency, rows.length || 1)) }, worker));

  let swept = 0;
  const sweep = await deps.admin.rpc("place_charges_sweep");
  if (sweep.error) console.error("[settle-cron] place_charges_sweep", sweep.error.message);
  else swept = Number(sweep.data ?? 0);

  // Pending credit that turned Available since the last ticks: one
  // notification per guest, place and ready time, never twice (the
  // function's unique key). Only this key's universe.
  let notified = 0;
  const ready = await deps.admin.rpc("wallet_notify_ready_credit", { p_livemode: deps.livemode });
  if (ready.error) console.error("[settle-cron] wallet_notify_ready_credit", ready.error.message);
  else if (typeof ready.data === "number") notified = ready.data;

  const [p, y] = await Promise.all([
    deps.admin.from("wallet_purchases").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
    deps.admin.from("wallet_payments").select("id", { count: "exact", head: true }).eq("status", "needs_review"),
  ]);
  const needsReview = (p.count ?? 0) + (y.count ?? 0);
  if (needsReview > 0) console.error("[settle-cron] needs_review", JSON.stringify({ count: needsReview }));

  return { rows: rows.length, outcomes, needs_review_total: needsReview, charges_swept: swept, credit_ready_notified: notified, ms: deps.now() - started };
}
