// Consumer subscription API — opens a Stripe Checkout Session for Mesita
// Premium via the consumer-create-subscription Edge Function. The EF returns
// a hosted checkout URL; the caller redirects the browser to it. Premium is
// only granted once Stripe confirms payment (handled server-side by the
// webhook).

import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

export async function apiCreateSubscriptionCheckout(
  client: SupabaseClient,
  opts: { successUrl?: string; cancelUrl?: string } = {},
  // `mock` is set by the EF when it ran the emulator instead of Stripe — either
  // MOCK_SUBSCRIPTION is on or there is no STRIPE_SECRET_KEY. It is the SERVER's
  // fact, never a client choice: the emulator grants a paid plan for free, so
  // the client must not be able to ask for it.
): Promise<{ checkout_url: string; mock?: boolean }> {
  return invokeEF<{ checkout_url: string; mock?: boolean }>(
    client,
    "consumer-web-create-subscription",
    { successUrl: opts.successUrl, cancelUrl: opts.cancelUrl },
    "Couldn't start checkout",
  );
}
