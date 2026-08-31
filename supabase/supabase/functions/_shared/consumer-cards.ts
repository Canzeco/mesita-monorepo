// The Cards wallet — a consumer's saved payment methods.
//
// NAMING: Cards, never "wallet" (Pato, 2026-08-29). The Credits wallet holds
// Mesita Credits, which REDUCE a bill; this holds cards, which pay one. Two
// things, two words — sharing the noun was the confusion to avoid.
//
// STRIPE IS THE ONLY STORE. No PAN, no brand, no last4, no expiry and no
// default flag is ever written to Postgres: the whole local footprint is
// consumers.stripe_customer_id (the anchor, _shared/stripe-billing.ts
// ensureConsumerCustomer). A cached card summary would buy one API call and
// cost a permanent drift surface — a "•••• 4242" row that outlives the card.
//
// `is_default` is DERIVED per read from the customer's
// invoice_settings.default_payment_method. Remembering it locally is how a
// phantom Default pill survives a change made in the Stripe dashboard.
//
// MOCK is OPT-IN (`MOCK_CARDS=true`), matching the Connect posture in
// stripe-connect.ts: with the TEST key present these EFs do REAL work in the
// test universe, because a wallet you cannot actually put a card into proves
// nothing. Mock also fires when there is no STRIPE_SECRET_KEY at all, so a
// project with no Stripe secret still boots.

import Stripe from "npm:stripe@17";
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { json } from "./http.ts";
import {
  ensureConsumerCustomer,
  liveChargesBlocked,
  STRIPE_API_VERSION,
} from "./stripe-billing.ts";

/** The allowlisted card shape. A raw Stripe PaymentMethod never ships. */
export type CardSummary = {
  id: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
};

export function cardsMockMode(stripeKey: string | undefined): boolean {
  if (!stripeKey) return true;
  return (Deno.env.get("MOCK_CARDS") ?? "").toLowerCase() === "true";
}

export function toCardSummary(
  pm: Stripe.PaymentMethod,
  defaultPaymentMethodId: string | null,
): CardSummary {
  return {
    id: pm.id,
    brand: pm.card?.brand ?? null,
    last4: pm.card?.last4 ?? null,
    exp_month: pm.card?.exp_month ?? null,
    exp_year: pm.card?.exp_year ?? null,
    is_default: !!defaultPaymentMethodId && pm.id === defaultPaymentMethodId,
  };
}

export type CardContext = {
  stripe: Stripe;
  customerId: string;
};

/**
 * Resolves the Stripe client + this consumer's customer anchor, or returns the
 * Response to send instead (mock mode, or a live key without the MESITA-37
 * escape hatch). Saving a card is not itself a charge, but a card saved on a
 * live account is precisely something that gets charged later — the same
 * reasoning that put Connect account creation behind this gate.
 */
export async function cardContext(
  admin: SupabaseClient,
  consumerId: string,
  mockBody: Record<string, unknown>,
): Promise<{ ok: true; ctx: CardContext } | { ok: false; response: Response }> {
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (cardsMockMode(stripeKey)) {
    return {
      ok: false,
      response: json({ ok: true, mock: true, ...mockBody }),
    };
  }
  const liveBlock = liveChargesBlocked(stripeKey!);
  if (liveBlock) {
    return {
      ok: false,
      response: json(
        { ok: false, error: liveBlock, code: "stripe_live_blocked" },
        409,
      ),
    };
  }
  const stripe = new Stripe(stripeKey!, { apiVersion: STRIPE_API_VERSION });
  const customerId = await ensureConsumerCustomer(admin, stripe, consumerId);
  return { ok: true, ctx: { stripe, customerId } };
}

/** The customer's default payment method id, or null. */
export async function defaultPaymentMethodId(
  stripe: Stripe,
  customerId: string,
): Promise<string | null> {
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;
  const def = customer.invoice_settings?.default_payment_method ?? null;
  return typeof def === "string" ? def : def?.id ?? null;
}

/**
 * Every WRITE takes a payment_method_id from the client, so ownership is
 * re-read from Stripe and matched against THIS consumer's customer. Without
 * it any authenticated guest could detach a stranger's card by guessing an
 * id. Returns the PaymentMethod, or the Response to send instead.
 */
export async function ownedCard(
  stripe: Stripe,
  customerId: string,
  paymentMethodId: string,
): Promise<
  { ok: true; pm: Stripe.PaymentMethod } | { ok: false; response: Response }
> {
  let pm: Stripe.PaymentMethod;
  try {
    pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  } catch {
    // Uniform miss — never confirms someone else's card exists.
    return {
      ok: false,
      response: json(
        { ok: false, error: "Card not found", code: "card_not_yours" },
        403,
      ),
    };
  }
  const owner = typeof pm.customer === "string"
    ? pm.customer
    : pm.customer?.id ?? null;
  if (!owner || owner !== customerId) {
    return {
      ok: false,
      response: json(
        { ok: false, error: "Card not found", code: "card_not_yours" },
        403,
      ),
    };
  }
  return { ok: true, pm };
}

/**
 * A card that backs a live Premium subscription cannot be removed silently:
 * Stripe would detach it, the next renewal would fail, and Premium would lapse
 * with nothing telling the guest why. Blocked, named, and the sheet offers
 * adding another first.
 */
export async function backsActiveSubscription(
  admin: SupabaseClient,
  stripe: Stripe,
  customerId: string,
  paymentMethodId: string,
  consumerId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("consumer_subscriptions")
    .select("status")
    .eq("consumer_id", consumerId)
    .in("status", ["active", "trialing", "past_due"])
    .limit(1)
    .maybeSingle();
  if (!data) return false;
  // Live subscription exists — it only breaks if THIS card is the one it draws
  // on. A second saved card is free to go.
  const def = await defaultPaymentMethodId(stripe, customerId);
  return def === paymentMethodId;
}
