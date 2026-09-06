// resolveChargeableOrganizationAccount is the ONE place the three-leg
// Mesita Pay readiness chain is computed — pinned here so
// consumer-web-get-ticket's cardRail flag and the actual charge attempt in
// consumer-web-select-ticket-payment can never disagree (MESITA-1414).

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { resolveChargeableOrganizationAccount } from "./mesita-pay-readiness.ts";

type Fixture = {
  place?: { mesita_pay_enabled: boolean } | null;
  organizationId?: string | null;
  account?:
    | { stripe_account_id: string; charges_enabled: boolean; details_submitted: boolean }
    | null;
};

function fakeAdmin(fx: Fixture): SupabaseClient {
  const chain = {
    _table: "",
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle: () => {
      if (chain._table === "places") {
        return Promise.resolve({ data: fx.place ?? null, error: null });
      }
      if (chain._table === "projects") {
        return Promise.resolve({
          data: fx.organizationId === undefined
            ? null
            : { organization_id: fx.organizationId },
          error: null,
        });
      }
      return Promise.resolve({ data: fx.account ?? null, error: null });
    },
  };
  return {
    from(table: string) {
      chain._table = table;
      return chain;
    },
  } as unknown as SupabaseClient;
}

Deno.test("payCard=false short-circuits before any query", async () => {
  let queried = false;
  const admin = {
    from() {
      queried = true;
      throw new Error("should not query");
    },
  } as unknown as SupabaseClient;
  const res = await resolveChargeableOrganizationAccount(admin, false, "place_1");
  assertEquals(res, null);
  assertEquals(queried, false);
});

Deno.test("no placeId -> null", async () => {
  const admin = fakeAdmin({});
  assertEquals(await resolveChargeableOrganizationAccount(admin, true, null), null);
});

Deno.test("mesita_pay_enabled=false -> null, org never checked", async () => {
  const admin = fakeAdmin({ place: { mesita_pay_enabled: false } });
  assertEquals(
    await resolveChargeableOrganizationAccount(admin, true, "place_1"),
    null,
  );
});

Deno.test("no organization (pooled place) -> null", async () => {
  const admin = fakeAdmin({
    place: { mesita_pay_enabled: true },
    organizationId: null,
  });
  assertEquals(
    await resolveChargeableOrganizationAccount(admin, true, "place_1"),
    null,
  );
});

Deno.test("organization has an account but it's not charge-ready -> null", async () => {
  const admin = fakeAdmin({
    place: { mesita_pay_enabled: true },
    organizationId: "org_1",
    account: { stripe_account_id: "acct_1", charges_enabled: false, details_submitted: true },
  });
  assertEquals(
    await resolveChargeableOrganizationAccount(admin, true, "place_1"),
    null,
  );
});

Deno.test("full chain ready -> the organization + connected account id", async () => {
  const admin = fakeAdmin({
    place: { mesita_pay_enabled: true },
    organizationId: "org_1",
    account: { stripe_account_id: "acct_1", charges_enabled: true, details_submitted: true },
  });
  assertEquals(await resolveChargeableOrganizationAccount(admin, true, "place_1"), {
    organizationId: "org_1",
    connectedAccountId: "acct_1",
  });
});
