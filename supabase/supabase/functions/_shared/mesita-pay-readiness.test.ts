// resolveChargeablePlaceAccount is the ONE place the three-leg Mesita Pay
// readiness chain is computed — pinned here so consumer-web-get-ticket's
// cardRail flag and the actual charge attempt in
// consumer-web-select-ticket-payment can never disagree (MESITA-1414).
//
// IT USED TO BE FOUR LEGS AND TWO ROWS OF IDENTITY. The place's intent bit was
// ANDed with its organization's, and the Connect account hung off the
// organization, so a "no organization" answer was its own null. MESITA-1892
// removed that layer: the intent bit absorbed the org's half and the account
// is the place's, so `places` is never read here at all — and a test that
// still queried it would be pinning a hop that cannot happen.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { resolveChargeablePlaceAccount } from "./mesita-pay-readiness.ts";

type Fixture = {
  place?: { mesita_pay_enabled: boolean } | null;
  account?:
    | { stripe_account_id: string; charges_enabled: boolean; details_submitted: boolean }
    | null;
};

function fakeAdmin(fx: Fixture): { admin: SupabaseClient; tables: string[] } {
  const tables: string[] = [];
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
      return Promise.resolve({ data: fx.account ?? null, error: null });
    },
  };
  const admin = {
    from(table: string) {
      tables.push(table);
      chain._table = table;
      return chain;
    },
  } as unknown as SupabaseClient;
  return { admin, tables };
}

Deno.test("payCard=false short-circuits before any query", async () => {
  let queried = false;
  const admin = {
    from() {
      queried = true;
      throw new Error("should not query");
    },
  } as unknown as SupabaseClient;
  const res = await resolveChargeablePlaceAccount(admin, false, "place_1");
  assertEquals(res, null);
  assertEquals(queried, false);
});

Deno.test("no placeId -> null", async () => {
  const { admin } = fakeAdmin({});
  assertEquals(await resolveChargeablePlaceAccount(admin, true, null), null);
});

Deno.test("mesita_pay_enabled=false -> null, the account is never read", async () => {
  const { admin, tables } = fakeAdmin({ place: { mesita_pay_enabled: false } });
  assertEquals(
    await resolveChargeablePlaceAccount(admin, true, "place_1"),
    null,
  );
  assertEquals(tables, ["place_profiles"]);
});

Deno.test("the place has no Connect account at all -> null", async () => {
  const { admin } = fakeAdmin({
    place: { mesita_pay_enabled: true },
    account: null,
  });
  assertEquals(
    await resolveChargeablePlaceAccount(admin, true, "place_1"),
    null,
  );
});

Deno.test("an account that is not charge-ready -> null", async () => {
  const { admin } = fakeAdmin({
    place: { mesita_pay_enabled: true },
    account: {
      stripe_account_id: "acct_1",
      charges_enabled: false,
      details_submitted: true,
    },
  });
  assertEquals(
    await resolveChargeablePlaceAccount(admin, true, "place_1"),
    null,
  );
});

Deno.test("full chain ready -> the place + its connected account id", async () => {
  const { admin, tables } = fakeAdmin({
    place: { mesita_pay_enabled: true },
    account: {
      stripe_account_id: "acct_1",
      charges_enabled: true,
      details_submitted: true,
    },
  });
  assertEquals(await resolveChargeablePlaceAccount(admin, true, "place_1"), {
    placeId: "place_1",
    connectedAccountId: "acct_1",
  });
  // Two rows, one per fact. The `places` hop that resolved the holder is gone
  // with the layer it resolved.
  assertEquals(tables, ["place_profiles", "place_payment_accounts"]);
});
