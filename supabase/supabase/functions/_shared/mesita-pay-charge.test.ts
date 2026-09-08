// chargeTicketWithMesitaPay — Stripe and Supabase fully MOCKED, no network.
// Locks the shape this module exists to get right (MESITA-1414):
//   - every connected-account call carries { stripeAccount } as request opts,
//     never as a body param (that's how a direct charge stays on the RIGHT
//     account instead of silently hitting the platform's own);
//   - a cached connected-account customer is reused, never re-minted;
//   - a fresh customer gets cached so the next charge at the same
//     organization reuses it;
//   - the PaymentIntent carries the idempotency key and the ticket id in
//     metadata (the webhook backstop's only way to find the ticket);
//   - Stripe's outcome states (succeeded / requires_action / card decline /
//     transport error) map to the right ChargeOutcome, never a thrown
//     exception the caller has to guess about;
//   - requires_action carries the client secret AND the connected account
//     (MESITA-1670) — without the account the browser looks for the intent on
//     the platform, which is the failure that reads like a bad secret.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type Stripe from "npm:stripe@17";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { chargeTicketWithMesitaPay } from "./mesita-pay-charge.ts";

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
  cloneId?: string;
  newCustomerId?: string;
  intent?: Partial<Stripe.PaymentIntent>;
  throwOn?: "clone" | "intent";
  intentError?: unknown;
}): { stripe: Stripe; calls: StripeCall[] } {
  const calls: StripeCall[] = [];
  const stripe = {
    customers: {
      create: (params: unknown, options: unknown) => {
        calls.push({ method: "customers.create", params, options });
        return Promise.resolve({ id: overrides.newCustomerId ?? "cus_conn_new" });
      },
    },
    paymentMethods: {
      create: (params: unknown, options: unknown) => {
        calls.push({ method: "paymentMethods.create", params, options });
        if (overrides.throwOn === "clone") {
          return Promise.reject(new Error("clone failed"));
        }
        return Promise.resolve({ id: overrides.cloneId ?? "pm_cloned" });
      },
      attach: (id: string, params: unknown, options: unknown) => {
        calls.push({ method: "paymentMethods.attach", params: { id, ...params as object }, options });
        return Promise.resolve({});
      },
    },
    paymentIntents: {
      create: (params: unknown, options: unknown) => {
        calls.push({ method: "paymentIntents.create", params, options });
        if (overrides.throwOn === "intent") {
          return Promise.reject(overrides.intentError ?? new Error("charge failed"));
        }
        return Promise.resolve({
          id: "pi_1",
          status: "succeeded",
          ...overrides.intent,
        });
      },
    },
  } as unknown as Stripe;
  return { stripe, calls };
}

const BASE_ARGS = {
  organizationId: "org_1",
  connectedAccountId: "acct_1",
  consumerId: "c_1",
  ticketId: "ticket_1",
  platformCustomerId: "cus_platform_1",
  platformPaymentMethodId: "pm_platform_1",
  amountCents: 5000,
  currency: "MXN",
  idempotencyKey: "mesita-pay:ticket_1:5000",
};

Deno.test("succeeds: clones, attaches to a NEW customer, caches it, charges direct", async () => {
  const { admin, writes } = fakeAdmin(null);
  const { stripe, calls } = fakeStripe({ newCustomerId: "cus_conn_new", cloneId: "pm_cloned" });

  const outcome = await chargeTicketWithMesitaPay(stripe, admin, BASE_ARGS);
  assert(outcome.ok);
  if (!outcome.ok) return;
  assertEquals(outcome.paymentIntentId, "pi_1");

  // A fresh customer was minted and cached for next time.
  assertEquals(writes, [
    { organization_id: "org_1", consumer_id: "c_1", stripe_customer_id: "cus_conn_new" },
  ]);

  // Every connected-account call carries stripeAccount as a REQUEST OPTION,
  // never mixed into the body params.
  const clone = calls.find((c) => c.method === "paymentMethods.create")!;
  assertEquals(clone.params, {
    customer: "cus_platform_1",
    payment_method: "pm_platform_1",
  });
  assertEquals(clone.options, { stripeAccount: "acct_1" });

  const attach = calls.find((c) => c.method === "paymentMethods.attach")!;
  assertEquals((attach.params as { customer: string }).customer, "cus_conn_new");
  assertEquals(attach.options, { stripeAccount: "acct_1" });

  const intent = calls.find((c) => c.method === "paymentIntents.create")!;
  assertEquals(intent.params, {
    amount: 5000,
    currency: "mxn",
    customer: "cus_conn_new",
    payment_method: "pm_cloned",
    confirm: true,
    metadata: { ticket_id: "ticket_1", consumer_id: "c_1" },
  });
  assertEquals(intent.options, { stripeAccount: "acct_1", idempotencyKey: BASE_ARGS.idempotencyKey });
});

Deno.test("a cached connected-account customer is reused — no customers.create call", async () => {
  const { admin } = fakeAdmin("cus_conn_cached");
  const { stripe, calls } = fakeStripe({});

  const outcome = await chargeTicketWithMesitaPay(stripe, admin, BASE_ARGS);
  assert(outcome.ok);
  assert(!calls.some((c) => c.method === "customers.create"));
  const intent = calls.find((c) => c.method === "paymentIntents.create")!;
  assertEquals((intent.params as { customer: string }).customer, "cus_conn_cached");
});

Deno.test("application_fee_amount is only sent when explicitly asked for", async () => {
  const { admin } = fakeAdmin("cus_conn_cached");
  const { stripe: withoutFee, calls: c1 } = fakeStripe({});
  await chargeTicketWithMesitaPay(withoutFee, admin, BASE_ARGS);
  const intent1 = c1.find((c) => c.method === "paymentIntents.create")!;
  assert(!("application_fee_amount" in (intent1.params as object)));

  const { stripe: withFee, calls: c2 } = fakeStripe({});
  await chargeTicketWithMesitaPay(withFee, admin, { ...BASE_ARGS, applicationFeeCents: 150 });
  const intent2 = c2.find((c) => c.method === "paymentIntents.create")!;
  assertEquals((intent2.params as { application_fee_amount: number }).application_fee_amount, 150);
});

Deno.test("requires_action hands back everything the browser needs to finish it", async () => {
  // MESITA-1670. This used to be a terminal failure telling the guest to pay
  // at the register — fine for a ticket, impossible for a Credits top-up,
  // which has no register. The intent is REAL and confirmable, so the caller
  // gets the secret, the intent id, and the account the intent lives on.
  const { admin } = fakeAdmin("cus_conn_cached");
  const { stripe } = fakeStripe({
    intent: { status: "requires_action", client_secret: "pi_1_secret_abc" },
  });
  const outcome = await chargeTicketWithMesitaPay(stripe, admin, BASE_ARGS);
  assert(!outcome.ok);
  if (outcome.ok) return;
  assertEquals(outcome.code, "requires_action");
  if (outcome.code !== "requires_action") return;
  assertEquals(outcome.action.clientSecret, "pi_1_secret_abc");
  assertEquals(outcome.action.paymentIntentId, "pi_1");
  // THE ACCOUNT IS THE POINT. A direct charge lives on the connected account;
  // Stripe.js initialised against the platform cannot see the intent at all.
  assertEquals(outcome.action.connectedAccountId, BASE_ARGS.connectedAccountId);
  // And the copy stops sending them to the register — there is a step now.
  assert(!outcome.error.includes("register"));
});

Deno.test("requires_action with no client secret degrades to terminal, never a half-promise", async () => {
  // client_secret is the one field Stripe may omit. With no secret the browser
  // has nothing to confirm against, so promising a challenge would strand the
  // guest mid-flow; it falls back to the old behaviour and names the register.
  const { admin } = fakeAdmin("cus_conn_cached");
  const { stripe } = fakeStripe({
    intent: { status: "requires_action", client_secret: null },
  });
  const outcome = await chargeTicketWithMesitaPay(stripe, admin, BASE_ARGS);
  assert(!outcome.ok);
  if (outcome.ok) return;
  assertEquals(outcome.code, "card_declined");
  assert(outcome.error.includes("register"));
});

Deno.test("a StripeCardError maps to card_declined with Stripe's own message", async () => {
  const { admin } = fakeAdmin("cus_conn_cached");
  const { stripe } = fakeStripe({
    throwOn: "intent",
    intentError: { type: "StripeCardError", message: "Your card was declined." },
  });
  const outcome = await chargeTicketWithMesitaPay(stripe, admin, BASE_ARGS);
  assert(!outcome.ok);
  if (outcome.ok) return;
  assertEquals(outcome.code, "card_declined");
  assertEquals(outcome.error, "Your card was declined.");
});

Deno.test("a clone failure never reaches the PaymentIntent call", async () => {
  const { admin } = fakeAdmin("cus_conn_cached");
  const { stripe, calls } = fakeStripe({ throwOn: "clone" });
  const outcome = await chargeTicketWithMesitaPay(stripe, admin, BASE_ARGS);
  assert(!outcome.ok);
  if (outcome.ok) return;
  assertEquals(outcome.code, "stripe_error");
  assert(!calls.some((c) => c.method === "paymentIntents.create"));
});
