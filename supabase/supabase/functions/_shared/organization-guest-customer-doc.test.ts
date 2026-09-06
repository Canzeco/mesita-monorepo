import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  getOrganizationGuestCustomer,
  writeOrganizationGuestCustomer,
} from "./organization-guest-customer-doc.ts";

function fakeAdmin(
  readResult: { data: unknown; error: null },
  upsertResult: { error: { message: string } | null } = { error: null },
) {
  const upserts: unknown[] = [];
  const chain = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve(readResult),
    upsert: (row: unknown) => {
      upserts.push(row);
      return Promise.resolve(upsertResult);
    },
  };
  return { admin: { from: () => chain } as unknown as SupabaseClient, upserts };
}

Deno.test("getOrganizationGuestCustomer: returns the cached row, or null", async () => {
  const { admin: withRow } = fakeAdmin({
    data: {
      organization_id: "org_1",
      consumer_id: "c_1",
      stripe_customer_id: "cus_conn_1",
      created_at: "2026-01-01T00:00:00Z",
    },
    error: null,
  });
  const row = await getOrganizationGuestCustomer(withRow, "org_1", "c_1");
  assertEquals(row?.stripe_customer_id, "cus_conn_1");

  const { admin: empty } = fakeAdmin({ data: null, error: null });
  assertEquals(await getOrganizationGuestCustomer(empty, "org_1", "c_1"), null);
});

Deno.test("writeOrganizationGuestCustomer: upserts on (organization_id, consumer_id)", async () => {
  const { admin, upserts } = fakeAdmin({ data: null, error: null });
  const res = await writeOrganizationGuestCustomer(admin, {
    organizationId: "org_1",
    consumerId: "c_1",
    stripeCustomerId: "cus_conn_1",
  });
  assert(res.ok);
  assertEquals(upserts, [
    { organization_id: "org_1", consumer_id: "c_1", stripe_customer_id: "cus_conn_1" },
  ]);
});

Deno.test("writeOrganizationGuestCustomer: surfaces a db error", async () => {
  const { admin } = fakeAdmin({ data: null, error: null }, { error: { message: "boom" } });
  const res = await writeOrganizationGuestCustomer(admin, {
    organizationId: "org_1",
    consumerId: "c_1",
    stripeCustomerId: "cus_conn_1",
  });
  assert(!res.ok);
});
