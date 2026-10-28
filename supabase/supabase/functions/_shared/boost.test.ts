// MESITA-2789 (was Spotlight, MESITA-1998) — Boost's money rules: what a guest is charged, what a
// place's backings buy together, which key addresses Stripe, and the
// boost a paid tier earns in the Area score.

import { assertEquals } from "jsr:@std/assert@1";
import {
  checkoutParams,
  isAllowedReturnUrl,
  isLiveBacking,
  boostAmountCents,
  monthlyEquivalentCents,
  parseBoostStart,
  boostStripeKey,
  subscriptionPatch,
  tierFromMonthlyCents,
} from "./boost.ts";
import { premierFactor } from "./area-score.ts";

Deno.test("boost: $10 · $50 · $200 a month, a year for the price of ten months", () => {
  assertEquals(boostAmountCents("boost_2x", "month"), 1000);
  assertEquals(boostAmountCents("boost_5x", "month"), 5000);
  assertEquals(boostAmountCents("boost_10x", "month"), 20000);
  assertEquals(boostAmountCents("boost_2x", "year"), 10000);
  assertEquals(boostAmountCents("boost_5x", "year"), 50000);
  assertEquals(boostAmountCents("boost_10x", "year"), 200000);
});

Deno.test("boost: pooled monthly cents buy the tier (the SQL trigger's thresholds)", () => {
  assertEquals(tierFromMonthlyCents(999), 0);
  assertEquals(tierFromMonthlyCents(1000), 1);
  assertEquals(tierFromMonthlyCents(4999), 1);
  assertEquals(tierFromMonthlyCents(5000), 2);
  assertEquals(tierFromMonthlyCents(19999), 2);
  assertEquals(tierFromMonthlyCents(20000), 3);
});

Deno.test("boost: a yearly backing buys the same tier as its monthly twin", () => {
  for (const tier of ["boost_2x", "boost_5x", "boost_10x"] as const) {
    const yearly = monthlyEquivalentCents(boostAmountCents(tier, "year"), "year");
    const monthly = monthlyEquivalentCents(boostAmountCents(tier, "month"), "month");
    assertEquals(yearly, monthly);
    assertEquals(tierFromMonthlyCents(yearly), tierFromMonthlyCents(monthly));
  }
  // Two $10/mo backers pool to $20, still Boost 2x; five reach Boost 5x.
  assertEquals(tierFromMonthlyCents(2 * 1000), 1);
  assertEquals(tierFromMonthlyCents(5 * 1000), 2);
});

Deno.test("boost: start refuses a tier that is not one of the three", () => {
  const base = { place_id: "00000000-0000-4000-8000-000000000000", return_url: "https://consumer.mesita.ai/p" };
  assertEquals(parseBoostStart({ ...base, tier: "boost_5x" }).ok, true);
  assertEquals(parseBoostStart({ ...base, tier: "boost" }).ok, false);
  assertEquals(parseBoostStart({ ...base, tier: "boost_20x" }).ok, false);
});
Deno.test("boost: test mode unless live is set AND allowed; never the other mode's key", () => {
  const env = (o: Record<string, string>) => (k: string) => o[k];
  assertEquals(boostStripeKey(env({ STRIPE_SECRET_KEY_TEST: "sk_test", STRIPE_SECRET_KEY_LIVE: "sk_live" })), "sk_test");
  assertEquals(boostStripeKey(env({ STRIPE_MODE: "live", STRIPE_SECRET_KEY_LIVE: "sk_live" })), null);
  assertEquals(
    boostStripeKey(env({ STRIPE_MODE: "live", STRIPE_ALLOW_LIVE: "true", STRIPE_SECRET_KEY_LIVE: "sk_live" })),
    "sk_live",
  );
  assertEquals(boostStripeKey(env({ STRIPE_MODE: "test", STRIPE_SECRET_KEY_LIVE: "sk_live" })), null);
});

Deno.test("boost: Checkout charges the server's price and comes back only to Mesita", () => {
  assertEquals(isAllowedReturnUrl("https://consumer.mesita.ai/place/x"), true);
  assertEquals(isAllowedReturnUrl("https://web-consumer-git-x-canzeco.vercel.app/place/x"), true);
  assertEquals(isAllowedReturnUrl("https://evil.example/place/x"), false);
  assertEquals(isAllowedReturnUrl("http://consumer.mesita.ai/place/x"), false);
  const p = checkoutParams(
    { placeId: "p", tier: "boost_5x", interval: "year", returnUrl: "https://consumer.mesita.ai/place/p" },
    { backingId: "b", consumerId: "c", placeName: "Nectar" },
  ) as { line_items: Array<{ price_data: { unit_amount: number; recurring: { interval: string } } }>; success_url: string };
  assertEquals(p.line_items[0].price_data.unit_amount, 50000);
  assertEquals(p.line_items[0].price_data.recurring.interval, "year");
  assertEquals(p.success_url, "https://consumer.mesita.ai/place/p?boost={CHECKOUT_SESSION_ID}");
});

Deno.test("boost: the period is read from the item when the top level lacks it", () => {
  const patch = subscriptionPatch({
    id: "sub_1",
    status: "active",
    customer: "cus_1",
    items: { data: [{ current_period_end: 1_900_000_000 }] },
  });
  assertEquals(patch.current_period_end, new Date(1_900_000_000_000).toISOString());
  assertEquals(isLiveBacking({ status: "active", current_period_end: patch.current_period_end }, 0), true);
  assertEquals(isLiveBacking({ status: "past_due", current_period_end: patch.current_period_end }, 0), false);
});

Deno.test("premier: the factor is the tier's number; a Google stub is never Premier (MESITA-2925)", () => {
  assertEquals(premierFactor({ source: "mesita", boostTier: 0 }), 1);
  assertEquals(premierFactor({ source: "mesita", boostTier: 1 }), 2);
  assertEquals(premierFactor({ source: "mesita", boostTier: 2 }), 5);
  assertEquals(premierFactor({ source: "mesita", boostTier: 3 }), 10);
  assertEquals(premierFactor({ source: "mesita" }), 1);
  assertEquals(premierFactor({ source: "google", boostTier: 3 }), 1);
});
