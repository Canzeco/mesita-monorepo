// Signature verification for the one Stripe webhook endpoint, which several
// signing secrets serve: the platform endpoint's, and — once the operator
// creates the Connect endpoint (same URL, pinned to account.updated) — the
// Connect one, in each universe that has credentials (stripe-env.ts orders
// the set from STRIPE_MODE, active mode first). Each delivery is signed by
// exactly one endpoint's secret, so verification tries each configured secret
// in order and the first match wins. A request no secret verifies is
// rejected; signature verification remains the ENTIRE auth story of this
// verify_jwt=false surface. Verifying a delivery is not the same as acting on
// it — the caller drops events from the other universe (see index.ts).

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
