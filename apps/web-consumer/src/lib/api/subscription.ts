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
): Promise<{ checkout_url: string }> {
  return invokeEF<{ checkout_url: string }>(
    client,
    "consumer-web-create-subscription",
    { successUrl: opts.successUrl, cancelUrl: opts.cancelUrl },
    "Couldn't start checkout",
  );
}
