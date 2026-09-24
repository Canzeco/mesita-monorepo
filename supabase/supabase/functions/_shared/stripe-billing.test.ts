// Unit tests for the shared Stripe billing catalog + price resolver
// (MESITA-142, Promos v4 cutover MESITA-541). Stripe and Supabase are fully
// MOCKED — no network, no live Stripe account is ever touched.
//   deno test supabase/functions/_shared/stripe-billing.test.ts
//
// resolvePlanPrice() is the self-provisioning price resolver. The contract we
// lock here:
//   • the catalog is the source of truth for the plan mapping (consumer
//     Premium monthly / the place's yearly Mesita Membership / the older
//     per-place Verified year), amounts from DB;
//   • a cached stripe_price_id that still matches the DB row is a fast-path
//     hit — no product/price is created (idempotent);
//   • a missing lookup row yields null (no accidental provisioning);
//   • when nothing matches, exactly one product + one price are provisioned and
//     the new price id is cached back onto the row.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type Stripe from "npm:stripe@17";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  liveChargesBlocked,
  readPlaceBillingCustomer,
  resolvePlanPrice,
  STRIPE_CATALOG,
} from "./stripe-billing.ts";

// ─── Catalog contract ────────────────────────────────────────────────────

Deno.test("STRIPE_CATALOG: every sold plan maps to its own DB row", () => {
  const byId = Object.fromEntries(STRIPE_CATALOG.map((e) => [e.id, e]));
  assertEquals(STRIPE_CATALOG.length, 4);

  assertEquals(byId["consumer_premium"].table, "consumer_plans");
  assertEquals(byId["consumer_premium"].rowKey, "premium");
  assertEquals(byId["consumer_premium"].lookupKey, "consumer_premium_monthly");
  assertEquals(byId["consumer_premium"].interval, "month");

  // The place's yearly Mesita Membership (MESITA-1877, re-scoped to the place
  // by MESITA-1892 — `org_plans` became `membership_plans` with the layer it
  // was named for) — what is SOLD now.
  assertEquals(byId["business_partner_membership"].table, "membership_plans");
  assertEquals(byId["business_partner_membership"].rowKey, "membership");
  assertEquals(
    byId["business_partner_membership"].lookupKey,
    "business_partner_membership_yearly",
  );
  assertEquals(byId["business_partner_membership"].interval, "year");

  // The per-PLACE SKU it supersedes. Its door is retired (MESITA-1889
  // archived business-web-change-subscription), but the entry STAYS: it
  // anchors the provisioned Stripe price, and deleting it would orphan that
  // price and any subscription still billing on it.
  assertEquals(byId["business_verified"].table, "place_plans");
  assertEquals(byId["business_verified"].rowKey, "pro");
  assertEquals(byId["business_verified"].lookupKey, "business_pro_monthly");
  assertEquals(byId["business_verified"].interval, "month");
  assertEquals(byId["business_verified"].productName, "Mesita Pro");

  assertEquals(byId["business_ultra"].table, "place_plans");
  assertEquals(byId["business_ultra"].rowKey, "ultra");
  assertEquals(byId["business_ultra"].lookupKey, "business_ultra_monthly");
  assertEquals(byId["business_ultra"].interval, "month");
});

Deno.test("STRIPE_CATALOG: lookup keys are unique (idempotency anchors)", () => {
  const keys = STRIPE_CATALOG.map((e) => e.lookupKey);
  assertEquals(new Set(keys).size, keys.length);
});

// resolvePlanPrice caches the provisioned price id back onto table.rowKey.
// Two entries sharing one lookup row would each overwrite the other's id,
// fail their own verification on the next read, and mint a fresh Stripe price
// on EVERY checkout — which is why the Membership got membership_plans rather
// than borrowing place_plans.pro at the same MX$1,000.
Deno.test("STRIPE_CATALOG: one lookup row per entry", () => {
  const rows = STRIPE_CATALOG.map((e) => `${e.table}.${e.rowKey}`);
  assertEquals(new Set(rows).size, rows.length);
});

Deno.test("liveChargesBlocked: test keys and missing live flag never block", () => {
  const prev = Deno.env.get("STRIPE_ALLOW_LIVE");
  Deno.env.delete("STRIPE_ALLOW_LIVE");
  try {
    assertEquals(liveChargesBlocked("sk_test_abc"), null);
    assertEquals(liveChargesBlocked("rk_live_not_a_secret"), null);
    assert(liveChargesBlocked("sk_live_abc") !== null);
  } finally {
    if (prev === undefined) Deno.env.delete("STRIPE_ALLOW_LIVE");
    else Deno.env.set("STRIPE_ALLOW_LIVE", prev);
  }
});

Deno.test("liveChargesBlocked: STRIPE_ALLOW_LIVE=true is the human live flip", () => {
  const prev = Deno.env.get("STRIPE_ALLOW_LIVE");
  Deno.env.set("STRIPE_ALLOW_LIVE", "true");
  try {
    assertEquals(liveChargesBlocked("sk_live_abc"), null);
  } finally {
    if (prev === undefined) Deno.env.delete("STRIPE_ALLOW_LIVE");
    else Deno.env.set("STRIPE_ALLOW_LIVE", prev);
  }
});

// ─── Fakes ──────────────────────────────────────────────────────────────

type PlanRow = {
  price_cents: number;
  currency: string;
  stripe_price_id: string | null;
};

// Minimal Supabase mock: one lookup row keyed by (table, key). Records the
// value written back by cachePriceId so tests can assert the cache.
function fakeAdmin(row: PlanRow | null): {
  admin: SupabaseClient;
  cached: { value: string | null };
} {
  const cached = { value: null as string | null };
  const builder = {
    _table: "",
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data: row, error: null });
    },
    update(patch: Record<string, unknown>) {
      if ("stripe_price_id" in patch) {
        cached.value = patch.stripe_price_id as string;
      }
      return { eq: () => Promise.resolve({ data: null, error: null }) };
    },
  };
  const admin = {
    from(table: string) {
      builder._table = table;
      return builder;
    },
  } as unknown as SupabaseClient;
  return { admin, cached };
}

function makePrice(over: Partial<Stripe.Price> = {}): Stripe.Price {
  return {
    id: "price_cached",
    active: true,
    unit_amount: 10000,
    currency: "mxn",
    recurring: { interval: "month" },
    product: "prod_1",
    lookup_key: "consumer_premium_monthly",
    ...over,
  } as unknown as Stripe.Price;
}

// ─── resolvePlanPrice ─────────────────────────────────────────────────────

Deno.test("resolvePlanPrice: unknown entry id -> null", async () => {
  const { admin } = fakeAdmin(null);
  const stripe = {} as unknown as Stripe;
  // deno-lint-ignore no-explicit-any
  const res = await resolvePlanPrice(admin, stripe, "nope" as any);
  assertEquals(res, null);
});

Deno.test("resolvePlanPrice: missing lookup row -> null (no provisioning)", async () => {
  const { admin } = fakeAdmin(null);
  let created = false;
  const stripe = {
    prices: {
      retrieve: () => Promise.reject(new Error("should not be called")),
      create: () => {
        created = true;
        return Promise.resolve(makePrice());
      },
      list: () => Promise.resolve({ data: [] }),
    },
    products: { create: () => Promise.resolve({ id: "prod_x" }) },
  } as unknown as Stripe;

  const res = await resolvePlanPrice(admin, stripe, "consumer_premium");
  assertEquals(res, null);
  assert(!created, "no Stripe price should be created when the row is missing");
});

Deno.test("resolvePlanPrice: cached price matching the row is the fast path (idempotent)", async () => {
  const { admin, cached } = fakeAdmin({
    price_cents: 10000,
    currency: "MXN",
    stripe_price_id: "price_cached",
  });
  let createCalls = 0;
  const stripe = {
    prices: {
      retrieve: (id: string) => Promise.resolve(makePrice({ id })),
      create: () => {
        createCalls++;
        return Promise.resolve(makePrice());
      },
      list: () => Promise.resolve({ data: [] }),
    },
    products: {
      create: () => Promise.resolve({ id: "prod_new" }),
    },
  } as unknown as Stripe;

  const res = await resolvePlanPrice(admin, stripe, "consumer_premium");
  assert(res);
  assertEquals(res.priceId, "price_cached");
  assertEquals(res.priceCents, 10000);
  assertEquals(res.currency, "MXN"); // uppercased
  assertEquals(createCalls, 0, "fast path must not create anything");
  assertEquals(cached.value, null, "fast path must not re-cache");
});

Deno.test("resolvePlanPrice: no cache -> provisions product+price once and caches it", async () => {
  const { admin, cached } = fakeAdmin({
    price_cents: 10000,
    currency: "MXN",
    stripe_price_id: null,
  });
  let productCreates = 0;
  let priceCreates = 0;
  const stripe = {
    prices: {
      retrieve: () => Promise.reject(new Error("no cached id")),
      list: () => Promise.resolve({ data: [] }), // nothing carries our lookup_key yet
      create: () => {
        priceCreates++;
        return Promise.resolve(makePrice({ id: "price_new", product: "prod_new" }));
      },
      update: () => Promise.resolve({}),
    },
    products: {
      search: () => Promise.resolve({ data: [] }),
      create: () => {
        productCreates++;
        return Promise.resolve({ id: "prod_new" });
      },
      update: () => Promise.resolve({}),
    },
  } as unknown as Stripe;

  const res = await resolvePlanPrice(admin, stripe, "consumer_premium");
  assert(res);
  assertEquals(res.priceId, "price_new");
  assertEquals(productCreates, 1);
  assertEquals(priceCreates, 1);
  assertEquals(cached.value, "price_new", "the new price id is cached back on the row");
});

Deno.test("resolvePlanPrice: a stale cached id that mismatches the row re-provisions", async () => {
  // Row wants 5000¢ but the cached price is 10000¢ — must be replaced.
  const { admin, cached } = fakeAdmin({
    price_cents: 5000,
    currency: "MXN",
    stripe_price_id: "price_old",
  });
  let priceCreates = 0;
  const stripe = {
    prices: {
      retrieve: (id: string) => Promise.resolve(makePrice({ id, unit_amount: 10000 })),
      list: () => Promise.resolve({ data: [] }),
      create: () => {
        priceCreates++;
        return Promise.resolve(makePrice({ id: "price_fresh", unit_amount: 5000 }));
      },
      update: () => Promise.resolve({}),
    },
    products: {
      search: () => Promise.resolve({ data: [] }),
      create: () => Promise.resolve({ id: "prod_fresh" }),
      update: () => Promise.resolve({}),
    },
  } as unknown as Stripe;

  const res = await resolvePlanPrice(admin, stripe, "consumer_premium");
  assert(res);
  assertEquals(res.priceId, "price_fresh");
  assertEquals(res.priceCents, 5000);
  assertEquals(priceCreates, 1);
  assertEquals(cached.value, "price_fresh");
});

Deno.test("resolvePlanPrice: Mesita Pro monthly provisions with month interval", async () => {
  const { admin, cached } = fakeAdmin({
    price_cents: 20000,
    currency: "MXN",
    stripe_price_id: null,
  });
  let createdInterval: string | null = null;
  const stripe = {
    prices: {
      retrieve: () => Promise.reject(new Error("no cached id")),
      list: () => Promise.resolve({ data: [] }),
      create: (args: { recurring: { interval: string } }) => {
        createdInterval = args.recurring.interval;
        return Promise.resolve(
          makePrice({
            id: "price_pro",
            unit_amount: 20000,
            lookup_key: "business_pro_monthly",
            recurring: { interval: "month" } as Stripe.Price.Recurring,
          }),
        );
      },
      update: () => Promise.resolve({}),
    },
    products: {
      search: () => Promise.resolve({ data: [] }),
      create: () => Promise.resolve({ id: "prod_pro" }),
      update: () => Promise.resolve({}),
    },
  } as unknown as Stripe;

  const res = await resolvePlanPrice(admin, stripe, "business_verified");
  assert(res);
  assertEquals(res.priceId, "price_pro");
  assertEquals(res.priceCents, 20000);
  assertEquals(createdInterval, "month");
  assertEquals(cached.value, "price_pro");
});

// ─── readPlaceBillingCustomer (MESITA-1891) ───────────────────────────────
//
// The Billing Portal's anchor. It READS and never mints, so each case below
// pairs with its opposite: the one input that must hand back a customer, and
// the three that must refuse rather than open an empty Stripe page or leave a
// stray Customer behind.

function fakePlace(row: Record<string, unknown> | null): SupabaseClient {
  const builder = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({ data: row, error: null });
    },
  };
  return { from: () => builder } as unknown as SupabaseClient;
}

Deno.test("readPlaceBillingCustomer: a stored real customer is the anchor", async () => {
  const res = await readPlaceBillingCustomer(
    fakePlace({ stripe_billing_customer_id: "cus_live_1" }),
    "p-1",
  );
  assertEquals(res, { ok: true, customerId: "cus_live_1" });
});

Deno.test("readPlaceBillingCustomer: no row is place_not_found, not an empty anchor", async () => {
  const res = await readPlaceBillingCustomer(fakePlace(null), "p-1");
  assert(!res.ok);
  assertEquals(res.code, "place_not_found");
});

Deno.test("readPlaceBillingCustomer: an unanchored place refuses instead of minting", async () => {
  const res = await readPlaceBillingCustomer(
    fakePlace({ stripe_billing_customer_id: null }),
    "p-1",
  );
  assert(!res.ok);
  assertEquals(res.code, "no_billing_customer");
});

Deno.test("readPlaceBillingCustomer: mock_cus_* reads as absent, never as a customer", async () => {
  // Handing MOCK_SUBSCRIPTION's placeholder to a live key 400s, so it must
  // never travel as an anchor — the same rule isMockCustomerId enforces on
  // the checkout path.
  const res = await readPlaceBillingCustomer(
    fakePlace({ stripe_billing_customer_id: "mock_cus_p-1" }),
    "p-1",
  );
  assert(!res.ok);
  assertEquals(res.code, "no_billing_customer");
});
