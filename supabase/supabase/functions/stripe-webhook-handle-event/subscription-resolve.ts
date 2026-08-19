import Stripe from "npm:stripe@17";
import { adminClient } from "../_shared/auth.ts";
import { STRIPE_CATALOG } from "../_shared/stripe-billing.ts";

// Maps a Stripe subscription back to a Mesita consumer via metadata, falling
// back to the customer's metadata.
export async function resolveConsumerId(
  admin: ReturnType<typeof adminClient>,
  stripe: Stripe,
  sub: Stripe.Subscription,
): Promise<string | null> {
  const fromSub = sub.metadata?.consumer_id as string | undefined;
  if (fromSub) return fromSub;
  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  // Try our own table first.
  const { data } = await admin
    .from("consumer_subscriptions")
    .select("consumer_id")
    .eq("stripe_customer_id", customerId)
    .limit(1)
    .maybeSingle();
  if (data?.consumer_id) return data.consumer_id as string;
  // Last resort: read the customer's metadata from Stripe.
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted) {
      return (customer.metadata?.consumer_id as string | undefined) ?? null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

// Maps a Stripe subscription back to a Mesita project via our own mirror
// table (subscription metadata was already checked by the caller).
export async function resolveProjectId(
  admin: ReturnType<typeof adminClient>,
  sub: Stripe.Subscription,
): Promise<string | null> {
  const { data: bySub } = await admin
    .from("project_subscriptions")
    .select("project_id")
    .eq("stripe_subscription_id", sub.id)
    .maybeSingle();
  if (bySub?.project_id) return bySub.project_id as string;

  const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer.id;
  const { data: byCustomer } = await admin
    .from("project_subscriptions")
    .select("project_id")
    .eq("stripe_customer_id", customerId)
    .limit(1)
    .maybeSingle();
  return (byCustomer?.project_id as string | undefined) ?? null;
}

// Resolves which Mesita plan a Stripe subscription pays for: subscription
// metadata first, then the price id against project_plans, then the price
// lookup_key against the static catalog.
export async function resolvePlanKey(
  admin: ReturnType<typeof adminClient>,
  sub: Stripe.Subscription,
): Promise<string | null> {
  const fromMeta = sub.metadata?.plan_key as string | undefined;
  if (fromMeta === "pro" || fromMeta === "ultra") return fromMeta;

  const price = sub.items.data[0]?.price ?? null;
  if (!price) return null;

  const { data } = await admin
    .from("project_plans")
    .select("key")
    .eq("stripe_price_id", price.id)
    .maybeSingle();
  if (data?.key) return data.key as string;

  const byLookup = STRIPE_CATALOG.find(
    (e) => e.lookupKey === price.lookup_key && e.table === "project_plans",
  );
  return byLookup?.rowKey ?? null;
}
