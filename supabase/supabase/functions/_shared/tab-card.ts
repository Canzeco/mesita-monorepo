// The guest's saved card and the next step a card payment hands the screen
// (MESITA-3563, kept for vouchers). MESITA-4708: the card part of a BILL is
// gone (Pay at the table T2b, the guest's ticket hold, Apple Pay / Google Pay
// on a bill): a bill is credit and the rest outside. What is left serves the
// voucher buy (consumer-web-buy-voucher, _shared/voucher-card.ts).
//
// The guest's card lives on Mesita's platform customer (saved cards,
// MESITA-3523), in the PAYMENTS mode (PAYMENTS_STRIPE_MODE), never the
// Premier one; an id from the browser is never trusted (ownCard).

import { type StripeCall, StripeError } from "./stripe.ts";

export function isPaymentMethodId(v: unknown): v is string {
  return typeof v === "string" && /^pm_[A-Za-z0-9]{8,64}$/.test(v);
}

/** The card the guest chose is on their own platform customer. */
export async function ownCard(stripe: StripeCall, customer: string | null, pmId: string): Promise<boolean> {
  if (!customer) return false;
  try {
    const pm = await stripe("GET", `payment_methods/${encodeURIComponent(pmId)}`);
    const owner = typeof pm.customer === "string" ? pm.customer : (pm.customer as { id?: string } | null)?.id ?? null;
    return owner === customer && pm.type === "card";
  } catch (err) {
    if (err instanceof StripeError && (err.code === "resource_missing" || err.httpStatus === 404)) return false;
    throw err;
  }
}

/** What the guest's screen does next with a card part. */
export type CardStep =
  | { status: "succeeded"; payment_intent_id: string }
  // MESITA-3856: held for the waiter; captured when they sign.
  | { status: "held"; payment_intent_id: string }
  | { status: "processing"; payment_intent_id: string }
  | {
    status: "requires_action";
    payment_intent_id: string;
    client_secret: string;
    stripe_account: string;
    publishable_key: string;
  }
  // MESITA-4386: an express hold waiting for the guest's Face ID / Google:
  // the browser confirms it with the client secret (Stripe's Express
  // Checkout Element). Never a bank check for runBankCheck.
  | {
    status: "requires_payment_method";
    express: true;
    payment_intent_id: string;
    client_secret: string;
    stripe_account: string;
    publishable_key: string;
    /** Stripe's units, exactly the PaymentIntent's amount. */
    amount_cents: number;
  };
