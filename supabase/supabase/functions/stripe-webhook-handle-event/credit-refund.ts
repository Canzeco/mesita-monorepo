// Connect-delivered charge.refunded / charge.dispute.created → claw back the
// matching credit_lots row (MESITA-1679).
//
// THE LEDGER IS THE SOURCE OF TRUTH, NOT THE ADMIN EF THAT REQUESTED IT.
// admin-web-refund-credit-lot only ever calls Stripe (refunds.create) — it
// never writes credit_ledger itself. This handler is the ONLY caller of
// reverse_credit_lot with kind='refund', so the ledger can never say "money
// came back" before Stripe has actually agreed it did. Same posture as
// ticket-payment-intent.ts: the synchronous path does the common-case work,
// the webhook is the thing that cannot be skipped.
//
// A refunded charge that is NOT a Credits purchase is common (ticket
// payments and consumer/place subscriptions all refund through this same
// event) — the credit_lots lookup by stripe_payment_intent_id simply misses
// and this handler is a no-op, exactly like handleConnectAccountUpdated's
// "unknown account" no-op.
//
// DISPUTE ≠ REFUND. A dispute is a freeze pending Stripe's investigation —
// no money has actually left the connected account on Mesita's side yet
// (Stripe holds it against the balance). Writing it as kind='refund' would
// claim money returned that has not; kind='adjust' freezes the lot's
// remainder without making that claim. If Mesita later wins the dispute,
// restoring the frozen amount is a manual follow-up (another 'issue' or
// 'adjust' row) — out of scope here, same as the expiry sweep's return-half
// follow-up: the ledger is append-only, so nothing about this design blocks
// it later.

import type Stripe from "npm:stripe@17";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

function paymentIntentIdOf(
  value: string | Stripe.PaymentIntent | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

async function findLotByPaymentIntent(
  admin: SupabaseClient,
  paymentIntentId: string,
): Promise<{ id: string } | null> {
  const { data } = await admin
    .from("credit_lots")
    .select("id")
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle();
  return (data as { id: string } | null) ?? null;
}

async function alreadyReversedCents(
  admin: SupabaseClient,
  lotId: string,
  kind: "refund" | "adjust",
): Promise<number> {
  const { data } = await admin
    .from("credit_ledger")
    .select("paid_delta_cents, bonus_delta_cents")
    .eq("lot_id", lotId)
    .eq("kind", kind);
  const rows = (data as { paid_delta_cents: number; bonus_delta_cents: number }[] | null) ?? [];
  return rows.reduce((sum, r) => sum - (r.paid_delta_cents + r.bonus_delta_cents), 0);
}

export async function handleChargeRefunded(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  const charge = event.data.object as Stripe.Charge;
  const paymentIntentId = paymentIntentIdOf(charge.payment_intent);
  if (!paymentIntentId) return;

  const lot = await findLotByPaymentIntent(admin, paymentIntentId);
  if (!lot) return; // not a Credits purchase — a ticket/subscription refund

  // `amount_refunded` is CUMULATIVE on the charge (Stripe's own field), so a
  // second partial refund on the same charge fires a second charge.refunded
  // event with a HIGHER cumulative total, not the new refund's own amount.
  // Diffing against what this lot's ledger already recorded as 'refund' is
  // what makes multiple partial refunds on one charge each apply exactly
  // once, with no dependence on stripe_events' event-id dedupe alone.
  const cumulativeRefunded = charge.amount_refunded ?? 0;
  const alreadyRefunded = await alreadyReversedCents(admin, lot.id, "refund");
  const delta = cumulativeRefunded - alreadyRefunded;
  if (delta <= 0) return; // already applied, or a refunded=false event

  const { data, error } = await admin.rpc("reverse_credit_lot", {
    p_lot_id: lot.id,
    p_kind: "refund",
    p_amount_cents: delta,
    p_reference: `stripe:charge.refunded:${event.id}`,
  });
  if (error) throw new Error(`credit_refund_reverse: ${error.message}`);
  const result = data as { ok: boolean; code?: string } | null;
  if (!result?.ok && result?.code !== "nothing_to_reverse") {
    throw new Error(`credit_refund_reverse: ${result?.code ?? "unknown"}`);
  }
}

export async function handleChargeDisputeCreated(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  const dispute = event.data.object as Stripe.Dispute;
  const paymentIntentId = paymentIntentIdOf(
    dispute.payment_intent as string | Stripe.PaymentIntent | null,
  );
  if (!paymentIntentId) return;

  const lot = await findLotByPaymentIntent(admin, paymentIntentId);
  if (!lot) return; // not a Credits purchase

  // Freeze the WHOLE remainder — a dispute puts the entire charge in
  // question, not just the disputed amount, and a guest must not be able to
  // spend a balance that may be reversed out from under the organization.
  const { data, error } = await admin.rpc("reverse_credit_lot", {
    p_lot_id: lot.id,
    p_kind: "adjust",
    p_amount_cents: null,
    p_reference: `stripe:charge.dispute.created:${dispute.id}`,
  });
  if (error) throw new Error(`credit_dispute_freeze: ${error.message}`);
  const result = data as { ok: boolean; code?: string } | null;
  if (!result?.ok && result?.code !== "nothing_to_reverse") {
    throw new Error(`credit_dispute_freeze: ${result?.code ?? "unknown"}`);
  }
}
