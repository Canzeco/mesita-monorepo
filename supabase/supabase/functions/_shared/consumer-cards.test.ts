// The Cards wallet's guards. Two of these are the security story: a card id
// arrives from the client on every write, and a card that backs live Premium
// must not vanish silently. The rest pin the "Stripe is the only store"
// posture — is_default derived, never remembered; mock invents no card.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type Stripe from "npm:stripe@17";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  backsActiveSubscription,
  cardsMockMode,
  ownedCard,
  toCardSummary,
} from "./consumer-cards.ts";

function pm(id: string, customer: string | null): Stripe.PaymentMethod {
  return {
    id,
    customer,
    card: { brand: "visa", last4: "4242", exp_month: 4, exp_year: 2030 },
  } as unknown as Stripe.PaymentMethod;
}

function stripeStub(
  retrieve: (id: string) => Promise<Stripe.PaymentMethod>,
  customer?: Record<string, unknown>,
): Stripe {
  return {
    paymentMethods: { retrieve },
    customers: { retrieve: () => Promise.resolve(customer ?? {}) },
  } as unknown as Stripe;
}

Deno.test("mock is opt-in when a key exists, forced when it doesn't", () => {
  Deno.env.delete("MOCK_CARDS");
  // A TEST key does REAL work — a wallet you can't put a card into proves
  // nothing (the Connect posture from #1415).
  assert(!cardsMockMode("sk_test_123"));
  assert(cardsMockMode(undefined));
  Deno.env.set("MOCK_CARDS", "true");
  assert(cardsMockMode("sk_test_123"));
  Deno.env.delete("MOCK_CARDS");
});

Deno.test("card summary is allowlisted and is_default is derived", () => {
  const card = toCardSummary(pm("pm_1", "cus_1"), "pm_1");
  assertEquals(card, {
    id: "pm_1",
    brand: "visa",
    last4: "4242",
    exp_month: 4,
    exp_year: 2030,
    is_default: true,
  });
  // Same card, different customer default → not default. Nothing is
  // remembered locally, so a dashboard change reads back correctly.
  assertEquals(toCardSummary(pm("pm_1", "cus_1"), "pm_9").is_default, false);
  assertEquals(toCardSummary(pm("pm_1", "cus_1"), null).is_default, false);
});

Deno.test("ownership: a card belonging to another customer is refused", async () => {
  const stripe = stripeStub((id) =>
    Promise.resolve(pm(id, "cus_someone_else"))
  );
  const res = await ownedCard(stripe, "cus_mine", "pm_theirs");
  assert(!res.ok);
  assertEquals(res.response.status, 403);
  const body = await res.response.json();
  assertEquals(body.code, "card_not_yours");
});

Deno.test("ownership: an unknown card id is refused, not 500", async () => {
  const stripe = stripeStub(() => Promise.reject(new Error("No such PM")));
  const res = await ownedCard(stripe, "cus_mine", "pm_nope");
  assert(!res.ok);
  assertEquals(res.response.status, 403);
});

Deno.test("ownership: the guest's own card passes", async () => {
  const stripe = stripeStub((id) => Promise.resolve(pm(id, "cus_mine")));
  const res = await ownedCard(stripe, "cus_mine", "pm_mine");
  assert(res.ok);
  assertEquals(res.pm.id, "pm_mine");
});

function adminStub(subscriptionRow: unknown): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: subscriptionRow }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

Deno.test("removal guard: the card Premium draws on is protected", async () => {
  const stripe = stripeStub(
    (id) => Promise.resolve(pm(id, "cus_mine")),
    { invoice_settings: { default_payment_method: "pm_default" } },
  );
  assert(
    await backsActiveSubscription(
      adminStub({ status: "active" }),
      stripe,
      "cus_mine",
      "pm_default",
      "consumer_1",
    ),
  );
});

Deno.test("removal guard: a second card is free to go", async () => {
  const stripe = stripeStub(
    (id) => Promise.resolve(pm(id, "cus_mine")),
    { invoice_settings: { default_payment_method: "pm_default" } },
  );
  assert(
    !await backsActiveSubscription(
      adminStub({ status: "active" }),
      stripe,
      "cus_mine",
      "pm_spare",
      "consumer_1",
    ),
  );
});

Deno.test("removal guard: no live subscription means nothing to protect", async () => {
  const stripe = stripeStub(
    (id) => Promise.resolve(pm(id, "cus_mine")),
    { invoice_settings: { default_payment_method: "pm_default" } },
  );
  assert(
    !await backsActiveSubscription(
      adminStub(null),
      stripe,
      "cus_mine",
      "pm_default",
      "consumer_1",
    ),
  );
});
