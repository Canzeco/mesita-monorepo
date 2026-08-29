// ensureConsumerCustomer — ONE Stripe customer per consumer.
//
// Two doors would mean two customers for one guest, and a card saved against
// the one nobody charges. These pin the three resolution paths (anchored,
// inherited, minted) and the `mock_cus_*` guard that a live key would 400 on.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type Stripe from "npm:stripe@17";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { ensureConsumerCustomer, isMockCustomerId } from "./stripe-billing.ts";

type Tables = {
  consumers: { stripe_customer_id: string | null } | null;
  consumer_subscriptions: { stripe_customer_id: string | null } | null;
};

/** Records what got written so the tests can assert the anchor was set. */
function adminStub(tables: Tables) {
  const writes: Array<Record<string, unknown>> = [];
  const client = {
    from(table: string) {
      const row = tables[table as keyof Tables];
      const single = () => Promise.resolve({ data: row });
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: single,
            not: () => ({
              order: () => ({ limit: () => ({ maybeSingle: single }) }),
            }),
          }),
        }),
        update: (patch: Record<string, unknown>) => {
          writes.push(patch);
          tables.consumers = {
            stripe_customer_id: patch.stripe_customer_id as string,
          };
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, writes };
}

function stripeStub(newId = "cus_new") {
  let created = 0;
  const stripe = {
    customers: {
      create: () => {
        created++;
        return Promise.resolve({ id: newId } as Stripe.Customer);
      },
    },
  } as unknown as Stripe;
  return { stripe, createdCount: () => created };
}

Deno.test("a mock id is never a real customer", () => {
  assert(isMockCustomerId("mock_cus_abc"));
  assert(!isMockCustomerId("cus_abc"));
  assert(!isMockCustomerId(null));
  assert(!isMockCustomerId(undefined));
});

Deno.test("anchored: reuses the id on consumers, calls Stripe zero times", async () => {
  const { client } = adminStub({
    consumers: { stripe_customer_id: "cus_Anchored" },
    consumer_subscriptions: null,
  });
  const { stripe, createdCount } = stripeStub();
  assertEquals(
    await ensureConsumerCustomer(client, stripe, "consumer_1"),
    "cus_Anchored",
  );
  assertEquals(createdCount(), 0);
});

Deno.test("inherited: adopts the subscription's customer and anchors it", async () => {
  const { client, writes } = adminStub({
    consumers: { stripe_customer_id: null },
    consumer_subscriptions: { stripe_customer_id: "cus_FromSub" },
  });
  const { stripe, createdCount } = stripeStub();
  assertEquals(
    await ensureConsumerCustomer(client, stripe, "consumer_1"),
    "cus_FromSub",
  );
  // A pre-column subscriber must NOT get a second customer.
  assertEquals(createdCount(), 0);
  assertEquals(writes, [{ stripe_customer_id: "cus_FromSub" }]);
});

Deno.test("mock anchor is refused and replaced with a real customer", async () => {
  const { client, writes } = adminStub({
    consumers: { stripe_customer_id: "mock_cus_Consumer1" },
    consumer_subscriptions: null,
  });
  const { stripe, createdCount } = stripeStub("cus_Real");
  assertEquals(
    await ensureConsumerCustomer(client, stripe, "consumer_1"),
    "cus_Real",
  );
  assertEquals(createdCount(), 1);
  assertEquals(writes, [{ stripe_customer_id: "cus_Real" }]);
});

Deno.test("a mock id on the subscription row is not inherited either", async () => {
  const { client } = adminStub({
    consumers: { stripe_customer_id: null },
    consumer_subscriptions: { stripe_customer_id: "mock_cus_Consumer1" },
  });
  const { stripe, createdCount } = stripeStub("cus_Real");
  assertEquals(
    await ensureConsumerCustomer(client, stripe, "consumer_1"),
    "cus_Real",
  );
  assertEquals(createdCount(), 1);
});

Deno.test("fresh consumer: mints one customer and anchors it", async () => {
  const { client, writes } = adminStub({
    consumers: { stripe_customer_id: null },
    consumer_subscriptions: null,
  });
  const { stripe, createdCount } = stripeStub("cus_Minted");
  assertEquals(
    await ensureConsumerCustomer(client, stripe, "consumer_1"),
    "cus_Minted",
  );
  assertEquals(createdCount(), 1);
  assertEquals(writes, [{ stripe_customer_id: "cus_Minted" }]);
});
