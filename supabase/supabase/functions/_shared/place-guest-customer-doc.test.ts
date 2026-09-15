import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  getPlaceGuestCustomer,
  writePlaceGuestCustomer,
} from "./place-guest-customer-doc.ts";

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

Deno.test("getPlaceGuestCustomer: returns the cached row, or null", async () => {
  const { admin: withRow } = fakeAdmin({
    data: {
      place_id: "org_1",
      consumer_id: "c_1",
      stripe_customer_id: "cus_conn_1",
      created_at: "2026-01-01T00:00:00Z",
    },
    error: null,
  });
  const row = await getPlaceGuestCustomer(withRow, "org_1", "c_1");
  assertEquals(row?.stripe_customer_id, "cus_conn_1");

  const { admin: empty } = fakeAdmin({ data: null, error: null });
  assertEquals(await getPlaceGuestCustomer(empty, "org_1", "c_1"), null);
});

Deno.test("writePlaceGuestCustomer: upserts on (place_id, consumer_id)", async () => {
  const { admin, upserts } = fakeAdmin({ data: null, error: null });
  const res = await writePlaceGuestCustomer(admin, {
    placeId: "org_1",
    consumerId: "c_1",
    stripeCustomerId: "cus_conn_1",
  });
  assert(res.ok);
  assertEquals(upserts, [
    { place_id: "org_1", consumer_id: "c_1", stripe_customer_id: "cus_conn_1" },
  ]);
});

Deno.test("writePlaceGuestCustomer: surfaces a db error", async () => {
  const { admin } = fakeAdmin({ data: null, error: null }, { error: { message: "boom" } });
  const res = await writePlaceGuestCustomer(admin, {
    placeId: "org_1",
    consumerId: "c_1",
    stripeCustomerId: "cus_conn_1",
  });
  assert(!res.ok);
});
