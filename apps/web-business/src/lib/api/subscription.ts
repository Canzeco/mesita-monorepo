// Frontend API surface for place-plan billing (Promos v4 Verified membership).
//
// Architectural constraints honoured:
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Plan changes are billing: the EF talks to Stripe (or grants instantly in
//   mock mode) and the Stripe webhook is the only writer that flips
//   projects.plan on the paid door. Direct plan writes via apiUpdatePlace
//   are rejected server-side.
// - Sold SKU is Verified only (`plan=pro`, MX$1,000/year). Legacy `ultra` is
//   accepted by the EF but maps onto Verified (MESITA-541).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlacePlan } from "./places";
import { invokeEF, withPlaceId } from "./_invoke";

type ChangeSubscriptionResult = {
  plan: PlacePlan;
  // Present when the caller must complete Stripe Checkout (real mode) or
  // when the mock grant wants a redirect to the success URL.
  checkout_url?: string;
  // Mock mode: the plan was granted instantly, no money moved.
  mock?: boolean;
  // The project already holds a live Verified (or legacy ultra) subscription.
  already_subscribed?: boolean;
  // Legacy ultra → Verified switched in place on the live subscription.
  plan_switched?: boolean;
  // Downgrade to free is scheduled for period end (real subscriptions keep
  // what was paid for).
  scheduled_downgrade?: boolean;
  current_period_end?: string | null;
};

export async function apiChangeSubscription(
  client: SupabaseClient,
  input: {
    projectId: string;
    /** `pro` = Verified membership; `free` = cancel; `ultra` accepted as legacy alias for Verified. */
    plan: PlacePlan;
    successUrl?: string;
    cancelUrl?: string;
  },
): Promise<ChangeSubscriptionResult> {
  return await invokeEF<ChangeSubscriptionResult>(
    client,
    "business-web-change-subscription",
    withPlaceId(input),
    "Couldn't update the subscription",
  );
}
