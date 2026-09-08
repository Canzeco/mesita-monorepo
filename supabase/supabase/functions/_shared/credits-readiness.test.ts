// resolveChargeableOrganizationForCredits is the ONE place the Credits
// readiness chain is computed (MESITA-1676) — mirrors
// mesita-pay-readiness.test.ts's fixture shape exactly.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { resolveChargeableOrganizationForCredits } from "./credits-readiness.ts";

type Fixture = {
  place?: { credits_enabled: boolean } | null;
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
      if (chain._table === "place_profiles") {
        return Promise.resolve({ data: fx.place ?? null, error: null });
      }
      if (chain._table === "places") {
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

Deno.test("payCredits=false short-circuits before any query", async () => {
  let queried = false;
  const admin = {
    from() {
      queried = true;
      throw new Error("should not query");
    },
  } as unknown as SupabaseClient;
  const res = await resolveChargeableOrganizationForCredits(admin, false, "place_1");
  assertEquals(res, null);
  assertEquals(queried, false);
});

Deno.test("no placeId -> null", async () => {
  const admin = fakeAdmin({});
  assertEquals(
    await resolveChargeableOrganizationForCredits(admin, true, null),
    null,
  );
});

Deno.test("credits_enabled=false -> null, org never checked", async () => {
  const admin = fakeAdmin({ place: { credits_enabled: false } });
  assertEquals(
    await resolveChargeableOrganizationForCredits(admin, true, "place_1"),
    null,
  );
});

Deno.test("no organization (pooled place) -> null", async () => {
  const admin = fakeAdmin({
    place: { credits_enabled: true },
    organizationId: null,
  });
  assertEquals(
    await resolveChargeableOrganizationForCredits(admin, true, "place_1"),
    null,
  );
});

Deno.test("organization has an account but it's not charge-ready -> null", async () => {
  const admin = fakeAdmin({
    place: { credits_enabled: true },
    organizationId: "org_1",
    account: { stripe_account_id: "acct_1", charges_enabled: false, details_submitted: true },
  });
  assertEquals(
    await resolveChargeableOrganizationForCredits(admin, true, "place_1"),
    null,
  );
});

Deno.test("full chain ready -> the organization + connected account id", async () => {
  const admin = fakeAdmin({
    place: { credits_enabled: true },
    organizationId: "org_1",
    account: { stripe_account_id: "acct_1", charges_enabled: true, details_submitted: true },
  });
  assertEquals(
    await resolveChargeableOrganizationForCredits(admin, true, "place_1"),
    { organizationId: "org_1", connectedAccountId: "acct_1" },
  );
});
