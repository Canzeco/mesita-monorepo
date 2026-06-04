import { loadStripe, type Stripe } from "@stripe/stripe-js";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripePublishableKey(): string | null {
  const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim();
  return key && key.length > 0 ? key : null;
}

export function getStripePromise(): Promise<Stripe | null> | null {
  const key = getStripePublishableKey();
  if (!key) return null;
  if (!stripePromise) {
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
