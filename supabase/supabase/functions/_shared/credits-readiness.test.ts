// resolveChargeableOrganizationForCredits is the ONE place the Credits
// readiness chain is computed (MESITA-1676) — mirrors
// mesita-pay-readiness.test.ts's fixture shape exactly.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  organizationsAcceptingCredits,
  resolveChargeableOrganizationForCredits,
} from "./credits-readiness.ts";

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

// ── organizationsAcceptingCredits: the ANY-place org fact ──────────────────
// (MESITA-1674's "Also": a place-scoped bit becoming an org fact.)

type BulkFixture = {
  places?: { id: string; organization_id: string | null }[];
  acceptors?: { id: string }[];
  accounts?: { organization_id: string; charges_enabled: boolean; details_submitted: boolean }[];
};

function fakeBulkAdmin(fx: BulkFixture): SupabaseClient {
  const chain = {
    _table: "",
    _eqCalled: false,
    select() {
      return this;
    },
    in() {
      return this;
    },
    eq() {
      this._eqCalled = true;
      return this;
    },
    then(resolve: (v: { data: unknown; error: null }) => void) {
      // The query builder is awaited directly (no .maybeSingle()), so this
      // fake is thenable rather than exposing a separate terminal method.
      if (chain._table === "places") {
        resolve({ data: fx.places ?? [], error: null });
      } else if (chain._table === "place_profiles") {
        resolve({ data: fx.acceptors ?? [], error: null });
      } else {
        resolve({ data: fx.accounts ?? [], error: null });
      }
    },
  };
  return {
    from(table: string) {
      chain._table = table;
      return chain;
    },
  } as unknown as SupabaseClient;
}

Deno.test("organizationsAcceptingCredits: payCredits=false short-circuits before any query", async () => {
  let queried = false;
  const admin = {
    from() {
      queried = true;
      throw new Error("should not query");
    },
  } as unknown as SupabaseClient;
  const out = await organizationsAcceptingCredits(admin, ["org_1"], false);
  assertEquals([...out], []);
  assertEquals(queried, false);
});

Deno.test("organizationsAcceptingCredits: empty id list short-circuits too", async () => {
  const admin = { from: () => { throw new Error("should not query"); } } as unknown as SupabaseClient;
  const out = await organizationsAcceptingCredits(admin, [], true);
  assertEquals([...out], []);
});

Deno.test("organizationsAcceptingCredits: ANY one accepting place is enough for the whole org", async () => {
  const admin = fakeBulkAdmin({
    places: [
      { id: "place_1", organization_id: "org_1" },
      { id: "place_2", organization_id: "org_1" },
    ],
    // Only place_1 opted in; place_2 never did.
    acceptors: [{ id: "place_1" }],
    accounts: [{ organization_id: "org_1", charges_enabled: true, details_submitted: true }],
  });
  const out = await organizationsAcceptingCredits(admin, ["org_1"], true);
  assertEquals([...out], ["org_1"]);
});

Deno.test("organizationsAcceptingCredits: a place opting in does not carry a NON-charge-ready org", async () => {
  const admin = fakeBulkAdmin({
    places: [{ id: "place_1", organization_id: "org_1" }],
    acceptors: [{ id: "place_1" }],
    accounts: [{ organization_id: "org_1", charges_enabled: false, details_submitted: true }],
  });
  const out = await organizationsAcceptingCredits(admin, ["org_1"], true);
  assertEquals([...out], []);
});

Deno.test("organizationsAcceptingCredits: no accepting place anywhere -> empty, no account query needed", async () => {
  const admin = fakeBulkAdmin({
    places: [{ id: "place_1", organization_id: "org_1" }],
    acceptors: [],
  });
  const out = await organizationsAcceptingCredits(admin, ["org_1"], true);
  assertEquals([...out], []);
});
