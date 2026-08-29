// Shared Stripe billing helpers — catalog provisioning for Mesita subscriptions.
// Catalog entries live in stripe-billing-catalog.ts (re-exported below).
//
// resolvePlanPrice() is self-provisioning: the first real checkout after a
// deploy materializes the product + price in whatever Stripe account
// STRIPE_SECRET_KEY points at (live or sandbox), idempotently via lookup_key,
// and caches the resulting price id back onto the lookup row (consumer_plans /
// project_plans). A price change in the DB (e.g. Premium $200 → $100) is
// self-healing too: the cached price is re-verified against the row and a
// mismatched price is replaced (old one deactivated, lookup_key transferred).
// No dashboard step, and the secret never leaves the server.

import type Stripe from "npm:stripe@17";
import { type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  type PlanCatalogEntry,
  STRIPE_CATALOG,
} from "./stripe-billing-catalog.ts";

export type { PlanCatalogEntry };
export { STRIPE_CATALOG };

// Same version string prod has always passed. The cast keeps `deno check`
// happy when the locally-cached stripe@17 minor pins an older literal.
export const STRIPE_API_VERSION =
  "2025-03-31.basil" as Stripe.LatestApiVersion;

// MESITA-37 — stay on TEST until a human is ready to take real money.
// Checkout, catalog provisioning that would create live charges (or live
// Prices that later get charged), and Connect account creation (a live
// connected account is something that later gets charged —
// business-web-start-payment-onboarding) refuse an `sk_live_` secret unless
// STRIPE_ALLOW_LIVE=true. Cancels, webhooks, and the admin health probe are
// not this gate. Flipping the env is the needs-human step; this helper never
// does it.
export function liveChargesBlocked(secretKey: string): string | null {
  if (!secretKey.startsWith("sk_live_")) return null;
  const allow = (Deno.env.get("STRIPE_ALLOW_LIVE") ?? "").toLowerCase() ===
    "true";
  if (allow) return null;
  return "Stripe live charges are blocked. STRIPE_SECRET_KEY is sk_live_; set STRIPE_ALLOW_LIVE=true only when ready to take real money (MESITA-37).";
}

export type ResolvedPrice = {
  priceId: string;
  priceCents: number;
  currency: string; // uppercase ISO 4217, e.g. "MXN"
};

type PlanRow = {
  price_cents: number;
  currency: string;
  stripe_price_id: string | null;
};

// True when `price` is exactly the live recurring price the row asks for.
function priceMatchesRow(
  price: Stripe.Price,
  row: PlanRow,
  interval: PlanCatalogEntry["interval"],
): boolean {
  return (
    price.active &&
    price.unit_amount === row.price_cents &&
    price.currency.toLowerCase() === row.currency.toLowerCase() &&
    price.recurring?.interval === interval
  );
}

// Resolves (provisioning if needed) the Stripe price for a catalog entry.
// Reads the authoritative amount from the lookup row, verifies the cached
// stripe_price_id against it, and creates/repairs the Stripe side when they
// disagree. Returns null when the lookup row itself is missing.
export async function resolvePlanPrice(
  admin: SupabaseClient,
  stripe: Stripe,
  entryId: PlanCatalogEntry["id"],
): Promise<ResolvedPrice | null> {
  const entry = STRIPE_CATALOG.find((e) => e.id === entryId);
  if (!entry) return null;

  const { data: row } = await admin
    .from(entry.table)
    .select("price_cents, currency, stripe_price_id")
    .eq("key", entry.rowKey)
    .maybeSingle();
  if (!row) return null;
  const planRow = row as PlanRow;

  // Fast path: the cached price still matches the row.
  if (planRow.stripe_price_id) {
    try {
      const cached = await stripe.prices.retrieve(planRow.stripe_price_id);
      if (priceMatchesRow(cached, planRow, entry.interval)) {
        return {
          priceId: cached.id,
          priceCents: planRow.price_cents,
          currency: planRow.currency.toUpperCase(),
        };
      }
    } catch {
      // Cached id doesn't exist in this Stripe account (key rotated to a
      // different account/sandbox, or the price was deleted) — re-provision.
    }
  }

  // Second chance: a price already carries our lookup_key (e.g. provisioned
  // by a parallel request or an earlier deploy).
  let staleByLookup: Stripe.Price | null = null;
  try {
    const byLookup = await stripe.prices.list({
      lookup_keys: [entry.lookupKey],
      limit: 1,
    });
    const found = byLookup.data[0] ?? null;
    if (found && priceMatchesRow(found, planRow, entry.interval)) {
      await cachePriceId(admin, entry, found.id);
      return {
        priceId: found.id,
        priceCents: planRow.price_cents,
        currency: planRow.currency.toUpperCase(),
      };
    }
    staleByLookup = found;
  } catch {
    /* listing failed — fall through to provisioning */
  }

  // Provision. Reuse the product behind the stale price when there is one so
  // a price change doesn't spawn twin products; otherwise find the product by
  // metadata, and only then create it.
  let productId: string | null = staleByLookup
    ? typeof staleByLookup.product === "string"
      ? staleByLookup.product
      : staleByLookup.product.id
    : null;

  if (!productId) {
    try {
      const found = await stripe.products.search({
        query: `metadata['mesita_plan']:'${entry.id}' AND active:'true'`,
      });
      productId = found.data[0]?.id ?? null;
    } catch {
      /* search unsupported or failed — create below */
    }
  }

  if (!productId) {
    const product = await stripe.products.create({
      name: entry.productName,
      description: entry.productDescription,
      metadata: { mesita_plan: entry.id },
    });
    productId = product.id;
  }

  const price = await stripe.prices.create({
    product: productId,
    unit_amount: planRow.price_cents,
    currency: planRow.currency.toLowerCase(),
    recurring: { interval: entry.interval },
    lookup_key: entry.lookupKey,
    transfer_lookup_key: true,
    metadata: { mesita_plan: entry.id },
  });

  // Retire the superseded price so new checkouts can't pick it up, and point
  // the product's default at the fresh one.
  if (staleByLookup && staleByLookup.active && staleByLookup.id !== price.id) {
    try {
      await stripe.prices.update(staleByLookup.id, { active: false });
    } catch {
      /* non-fatal */
    }
  }
  try {
    await stripe.products.update(productId, { default_price: price.id });
  } catch {
    /* non-fatal */
  }

  await cachePriceId(admin, entry, price.id);
  return {
    priceId: price.id,
    priceCents: planRow.price_cents,
    currency: planRow.currency.toUpperCase(),
  };
}

async function cachePriceId(
  admin: SupabaseClient,
  entry: PlanCatalogEntry,
  priceId: string,
): Promise<void> {
  await admin
    .from(entry.table)
    .update({ stripe_price_id: priceId })
    .eq("key", entry.rowKey);
}

// Ensures the WHOLE catalog exists in Stripe, not just the plan being bought.
// Called fire-and-forget from checkout EFs so a single first checkout
// materializes all products for review in the dashboard. Errors are
// swallowed — the purchase path only depends on its own resolvePlanPrice.
export async function ensureWholeCatalog(
  admin: SupabaseClient,
  stripe: Stripe,
): Promise<void> {
  for (const entry of STRIPE_CATALOG) {
    try {
      await resolvePlanPrice(admin, stripe, entry.id);
    } catch {
      /* best effort */
    }
  }
}
