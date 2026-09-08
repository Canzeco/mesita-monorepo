// Connect-delivered payment_intent.{succeeded,payment_failed} → the
// reliability backstop for Credits purchases (MESITA-1676).
//
// consumer-web-buy-credits confirms the charge synchronously and writes the
// credit_lots row itself as "the confirm reader" in the common case — this
// handler exists for the rare crash between Stripe confirming and that call
// running, and for the requires_action (3DS) path: the guest may finish the
// bank's challenge in a tab whose original request already returned, and
// nothing else would ever create the lot.
//
// EVERY TERM COMES FROM THE INTENT'S OWN METADATA, NEVER RECOMPUTED. The
// PaymentIntent's metadata is where consumer-web-buy-credits pinned
// paid_cents / bonus_cents / activates_at / expires_at at the moment the
// charge was confirmed (mesita-pay-charge.ts, chargeCreditsWithMesitaPay) —
// re-deriving them from controls_config here would let an operator's Controls
// edit between the charge and this event silently change the terms of a
// purchase that already happened.
//
// Idempotent by construction: create_credit_lot is unique on
// stripe_payment_intent_id (20260908101212), so this handler racing the
// synchronous "confirm reader" — or a Stripe retry of the same event —
// always converges on the SAME lot, never a second one.
//
// ROUTING: stripe-webhook-handle-event/index.ts sends a Connect-delivered
// payment_intent event here only when intent.metadata.mesita_kind ===
// "credit_purchase" — anything else (a restaurant's own traffic, or a Mesita
// Pay ticket charge) goes to ticket-payment-intent.ts instead.

import type Stripe from "npm:stripe@17";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

/**
 * The routing decision itself, pulled out as a pure predicate so it is
 * testable without a database — the Deno EF suite has none at all
 * (money-path-efs.smoke.test.ts). stripe-webhook-handle-event/index.ts calls
 * this on every Connect-delivered payment_intent.{succeeded,payment_failed}
 * to choose between this file's handlers and ticket-payment-intent.ts's.
 */
export function isCreditPurchaseIntentEvent(event: Stripe.Event): boolean {
  const intent = event.data.object as Stripe.PaymentIntent;
  return intent?.metadata?.mesita_kind === "credit_purchase";
}

function pinnedTerms(intent: Stripe.PaymentIntent): {
  organizationId: string;
  consumerId: string;
  paidCents: number;
  bonusCents: number;
  currency: string;
  activatesAt: string;
  expiresAt: string;
} | null {
  const m = intent.metadata ?? {};
  const organizationId = m.organization_id;
  const consumerId = m.consumer_id;
  const activatesAt = m.activates_at;
  const expiresAt = m.expires_at;
  const paidCents = Number(m.paid_cents);
  const bonusCents = Number(m.bonus_cents ?? "0");
  if (
    !organizationId || !consumerId || !activatesAt || !expiresAt ||
    !Number.isFinite(paidCents)
  ) {
    return null;
  }
  return {
    organizationId,
    consumerId,
    paidCents,
    bonusCents: Number.isFinite(bonusCents) ? bonusCents : 0,
    currency: m.currency && m.currency.trim() ? m.currency : "MXN",
    activatesAt,
    expiresAt,
  };
}

export async function handleCreditPurchaseIntentSucceeded(
  admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  const intent = event.data.object as Stripe.PaymentIntent;
  const terms = pinnedTerms(intent);
  if (!terms) {
    // Missing/malformed metadata on an intent claiming to be ours — nothing
    // safe to act on. Logged, not thrown: throwing would roll back the
    // dedupe marker and retry forever on an event that will never improve.
    console.error(
      `[credit-payment-intent] succeeded ${intent.id} missing pinned terms — not recorded`,
    );
    return;
  }
  const lot = await admin.rpc("create_credit_lot", {
    p_organization_id: terms.organizationId,
    p_consumer_id: terms.consumerId,
    p_paid_cents: terms.paidCents,
    p_bonus_cents: terms.bonusCents,
    p_currency: terms.currency,
    p_activates_at: terms.activatesAt,
    p_expires_at: terms.expiresAt,
    p_stripe_payment_intent_id: intent.id,
  });
  if (lot.error) {
    throw new Error(`credit_lot_webhook: ${lot.error.message}`);
  }
}

// deno-lint-ignore require-await
export async function handleCreditPurchaseIntentFailed(
  _admin: SupabaseClient,
  event: Stripe.Event,
): Promise<void> {
  // No state was ever mutated before the charge for a Credits purchase —
  // unlike a ticket, there is no `paying` row to roll back. The guest just
  // sees the terminal outcome consumer-web-buy-credits already returned;
  // this only exists so a genuinely async failure (declined after
  // requires_action, off this request entirely) is visible in the logs
  // rather than silently dropped.
  const intent = event.data.object as Stripe.PaymentIntent;
  console.log(
    `[credit-payment-intent] payment_intent.payment_failed for ${intent.id} — no lot written, nothing to roll back`,
  );
}
