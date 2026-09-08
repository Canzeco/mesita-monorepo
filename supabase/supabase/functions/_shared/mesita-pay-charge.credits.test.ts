// chargeCreditsWithMesitaPay — Stripe and Supabase fully MOCKED, no network
// (MESITA-1676). Shares cloneCardAndChargeDirect with chargeTicketWithMesitaPay
// (mesita-pay-charge.test.ts covers that shared path in depth); this file
// locks the two things unique to the Credits caller:
//   - only paidCents is ever charged — bonusCents never reaches Stripe, it is
//     the organization's own top-up on top of a real charge;
//   - the PaymentIntent's metadata carries mesita_kind: "credit_purchase" plus
//     every pinned term, because that metadata is the webhook backstop's ONLY
//     way to find and replay this purchase later (stripe-webhook-handle-event
//     routes on mesita_kind, never re-derives terms from live config).

import { assert, assertEquals } from "jsr:@std/assert@1";
import type Stripe from "npm:stripe@17";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { chargeCreditsWithMesitaPay } from "./mesita-pay-charge.ts";

function fakeAdmin(cachedCustomerId: string | null) {
  const writes: unknown[] = [];
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () =>
      Promise.resolve({
        data: cachedCustomerId
          ? {
            organization_id: "org_1",
            consumer_id: "c_1",
            stripe_customer_id: cachedCustomerId,
            created_at: "2026-01-01T00:00:00Z",
          }
          : null,
        error: null,
      }),
    upsert: (row: unknown) => {
      writes.push(row);
      return Promise.resolve({ error: null });
    },
  };
  return { admin: { from: () => chain } as unknown as SupabaseClient, writes };
}

type StripeCall = { method: string; params: unknown; options: unknown };

function fakeStripe(overrides: {
  intent?: Partial<Stripe.PaymentIntent>;
}): { stripe: Stripe; calls: StripeCall[] } {
  const calls: StripeCall[] = [];
  const stripe = {
    customers: {
      create: (params: unknown, options: unknown) => {
        calls.push({ method: "customers.create", params, options });
        return Promise.resolve({ id: "cus_conn_new" });
      },
    },
    paymentMethods: {
      create: (params: unknown, options: unknown) => {
        calls.push({ method: "paymentMethods.create", params, options });
        return Promise.resolve({ id: "pm_cloned" });
      },
      attach: (id: string, params: unknown, options: unknown) => {
        calls.push({ method: "paymentMethods.attach", params: { id, ...params as object }, options });
        return Promise.resolve({});
      },
    },
    paymentIntents: {
      create: (params: unknown, options: unknown) => {
        calls.push({ method: "paymentIntents.create", params, options });
        return Promise.resolve({ id: "pi_1", status: "succeeded", ...overrides.intent });
      },
    },
  } as unknown as Stripe;
  return { stripe, calls };
}

const BASE_ARGS = {
  organizationId: "org_1",
  connectedAccountId: "acct_1",
  consumerId: "c_1",
  platformCustomerId: "cus_platform_1",
  platformPaymentMethodId: "pm_platform_1",
  paidCents: 50000,
  bonusCents: 5000,
  currency: "MXN",
  activatesAt: "2026-09-08T13:00:00.000Z",
  expiresAt: "2026-12-07T10:00:00.000Z",
  idempotencyKey: "credits-buy:c_1:req_1",
};

Deno.test("only paidCents is charged — bonusCents never reaches Stripe", async () => {
  const { admin } = fakeAdmin("cus_conn_cached");
  const { stripe, calls } = fakeStripe({});
  const outcome = await chargeCreditsWithMesitaPay(stripe, admin, BASE_ARGS);
  assert(outcome.ok);
  const intent = calls.find((c) => c.method === "paymentIntents.create")!;
  assertEquals((intent.params as { amount: number }).amount, 50000);
});

Deno.test("metadata carries mesita_kind and every pinned term, all as strings", async () => {
  const { admin } = fakeAdmin("cus_conn_cached");
  const { stripe, calls } = fakeStripe({});
  await chargeCreditsWithMesitaPay(stripe, admin, BASE_ARGS);
  const intent = calls.find((c) => c.method === "paymentIntents.create")!;
  assertEquals(
    (intent.params as { metadata: Record<string, string> }).metadata,
    {
      mesita_kind: "credit_purchase",
      organization_id: "org_1",
      consumer_id: "c_1",
      paid_cents: "50000",
      bonus_cents: "5000",
      currency: "MXN",
      activates_at: "2026-09-08T13:00:00.000Z",
      expires_at: "2026-12-07T10:00:00.000Z",
    },
  );
});

Deno.test("idempotency key rides the PaymentIntent as a request option", async () => {
  const { admin } = fakeAdmin("cus_conn_cached");
  const { stripe, calls } = fakeStripe({});
  await chargeCreditsWithMesitaPay(stripe, admin, BASE_ARGS);
  const intent = calls.find((c) => c.method === "paymentIntents.create")!;
  assertEquals(intent.options, {
    stripeAccount: "acct_1",
    idempotencyKey: "credits-buy:c_1:req_1",
  });
});

Deno.test("requires_action still hands back the connected account (MESITA-1670 pattern)", async () => {
  const { admin } = fakeAdmin("cus_conn_cached");
  const { stripe } = fakeStripe({
    intent: { status: "requires_action", client_secret: "pi_1_secret" },
  });
  const outcome = await chargeCreditsWithMesitaPay(stripe, admin, BASE_ARGS);
  assert(!outcome.ok);
  if (outcome.ok) return;
  assertEquals(outcome.code, "requires_action");
  if (outcome.code !== "requires_action") return;
  assertEquals(outcome.action.connectedAccountId, "acct_1");
});
