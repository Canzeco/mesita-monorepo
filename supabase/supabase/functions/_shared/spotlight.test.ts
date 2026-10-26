// MESITA-1998 — Spotlight's money rules: what a guest is charged, what a
// place's backings buy together, which key addresses Stripe, and the
// boost a paid tier earns in the Area score.

import { assertEquals } from "jsr:@std/assert@1";
import {
  checkoutParams,
  isAllowedReturnUrl,
  isLiveBacking,
  spotlightAmountCents,
  spotlightStripeKey,
  subscriptionPatch,
  tierFromMonthlyCents,
} from "./spotlight.ts";
import { selectedFactor } from "./area-score.ts";

Deno.test("spotlight: a guest pays $10 or $100 a month, twelve months a year", () => {
  assertEquals(spotlightAmountCents("spotlight", "month"), 1000);
  assertEquals(spotlightAmountCents("spotlight_plus", "month"), 10000);
  assertEquals(spotlightAmountCents("spotlight", "year"), 12000);
});

Deno.test("spotlight: pooled monthly cents buy the tier (the SQL trigger's thresholds)", () => {
  assertEquals(tierFromMonthlyCents(999), 0);
  assertEquals(tierFromMonthlyCents(1000), 1);
  assertEquals(tierFromMonthlyCents(9999), 1);
  assertEquals(tierFromMonthlyCents(10000), 2);
});

Deno.test("spotlight: test mode unless live is set AND allowed; never the other mode's key", () => {
  const env = (o: Record<string, string>) => (k: string) => o[k];
  assertEquals(spotlightStripeKey(env({ STRIPE_SECRET_KEY_TEST: "sk_test", STRIPE_SECRET_KEY_LIVE: "sk_live" })), "sk_test");
  assertEquals(spotlightStripeKey(env({ STRIPE_MODE: "live", STRIPE_SECRET_KEY_LIVE: "sk_live" })), null);
  assertEquals(
    spotlightStripeKey(env({ STRIPE_MODE: "live", STRIPE_ALLOW_LIVE: "true", STRIPE_SECRET_KEY_LIVE: "sk_live" })),
    "sk_live",
  );
  assertEquals(spotlightStripeKey(env({ STRIPE_MODE: "test", STRIPE_SECRET_KEY_LIVE: "sk_live" })), null);
});

Deno.test("spotlight: Checkout charges the server's price and comes back only to Mesita", () => {
  assertEquals(isAllowedReturnUrl("https://consumer.mesita.ai/place/x"), true);
  assertEquals(isAllowedReturnUrl("https://web-consumer-git-x-canzeco.vercel.app/place/x"), true);
  assertEquals(isAllowedReturnUrl("https://evil.example/place/x"), false);
  assertEquals(isAllowedReturnUrl("http://consumer.mesita.ai/place/x"), false);
  const p = checkoutParams(
    { placeId: "p", tier: "spotlight_plus", interval: "year", showName: false, returnUrl: "https://consumer.mesita.ai/place/p" },
    { backingId: "b", consumerId: "c", placeName: "Nectar" },
  ) as { line_items: Array<{ price_data: { unit_amount: number; recurring: { interval: string } } }>; success_url: string };
  assertEquals(p.line_items[0].price_data.unit_amount, 120000);
  assertEquals(p.line_items[0].price_data.recurring.interval, "year");
  assertEquals(p.success_url, "https://consumer.mesita.ai/place/p?spotlight={CHECKOUT_SESSION_ID}");
});

Deno.test("spotlight: the period is read from the item when the top level lacks it", () => {
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

Deno.test("spotlight: the boost is Selected's, squared for Plus, and never stacks with Selected", () => {
  const ctx = { selectedFactor: 3 };
  assertEquals(selectedFactor({ source: "mesita", spotlightTier: 0 }, ctx), 1);
  assertEquals(selectedFactor({ source: "mesita", spotlightTier: 1 }, ctx), 3);
  assertEquals(selectedFactor({ source: "mesita", spotlightTier: 2 }, ctx), 9);
  assertEquals(selectedFactor({ source: "selected", spotlightTier: 1 }, ctx), 3);
  assertEquals(selectedFactor({ source: "selected", spotlightTier: 2 }, ctx), 9);
  assertEquals(selectedFactor({ source: "google", spotlightTier: 2 }, ctx), 1);
});
