// Frontend API surface for place-plan billing.
//
// Architectural constraints honoured:
// - Clients NEVER query the database directly. Every read or write goes
//   through an Edge Function via `supabase.functions.invoke`.
// - Plan changes are billing: the EF talks to Stripe (or grants instantly in
//   mock mode) and the Stripe webhook is the only writer that flips
//   projects.plan on the paid door. Direct plan writes via apiUpdatePlace
//   are rejected server-side.

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlacePlan } from "./places";
import { invokeEF } from "./_invoke";

export type ChangeSubscriptionResult = {
  plan: PlacePlan;
  // Present when the caller must complete Stripe Checkout (real mode) or
  // when the mock grant wants a redirect to the success URL.
  checkout_url?: string;
  // Mock mode: the plan was granted instantly, no money moved.
  mock?: boolean;
  // The project already holds a live subscription on this plan.
  already_subscribed?: boolean;
  // pro↔ultra switched in place on the live subscription (prorated).
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
    plan: PlacePlan;
    successUrl?: string;
    cancelUrl?: string;
  },
): Promise<ChangeSubscriptionResult> {
  const { projectId, ...rest } = input;
  return await invokeEF<ChangeSubscriptionResult>(
    client,
    "business-change-subscription",
    // Canonical payload key is `placeId` (MESITA-26); local naming unchanged.
    { ...rest, placeId: projectId },
    "Couldn't update the subscription",
  );
}
