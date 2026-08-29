// Signature verification for the one Stripe webhook endpoint, now serving
// TWO signing secrets: the platform endpoint's STRIPE_WEBHOOK_SECRET and —
// once the operator creates the Connect endpoint (same URL, pinned to
// account.updated) — STRIPE_CONNECT_WEBHOOK_SECRET. Each delivery is signed
// by exactly one endpoint's secret, so verification tries each configured
// secret in order and the first match wins. A request no secret verifies is
// rejected; signature verification remains the ENTIRE auth story of this
// verify_jwt=false surface.

import type Stripe from "npm:stripe@17";

export async function verifyStripeEvent(
  stripe: Stripe,
  raw: string,
  signature: string,
  secrets: readonly (string | null | undefined)[],
): Promise<Stripe.Event> {
  let lastErr: unknown = new Error("no webhook secret configured");
  for (const secret of secrets) {
    if (!secret) continue;
    try {
      return await stripe.webhooks.constructEventAsync(raw, signature, secret);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
