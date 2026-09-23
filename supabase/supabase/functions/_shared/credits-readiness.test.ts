// resolveChargeablePlaceForCredits is the ONE place the Credits readiness
// chain is computed (MESITA-1676, re-scoped to the place by MESITA-1892) —
// mirrors mesita-pay-readiness.test.ts's fixture shape exactly.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  placesAcceptingCredits,
  placesHonouringCredits,
  resolveChargeablePlaceForCredits,
} from "./credits-readiness.ts";

type Fixture = {
  place?: { credits_enabled: boolean } | null;
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
  const res = await resolveChargeablePlaceForCredits(admin, false, "place_1");
  assertEquals(res, null);
  assertEquals(queried, false);
});

Deno.test("no placeId -> null", async () => {
  const admin = fakeAdmin({});
  assertEquals(
    await resolveChargeablePlaceForCredits(admin, true, null),
    null,
  );
});

Deno.test("credits_enabled=false -> null, the account is never checked", async () => {
  const admin = fakeAdmin({ place: { credits_enabled: false } });
  assertEquals(
    await resolveChargeablePlaceForCredits(admin, true, "place_1"),
    null,
  );
});

Deno.test("no connected account on the place -> null", async () => {
  const admin = fakeAdmin({ place: { credits_enabled: true }, account: null });
  assertEquals(
    await resolveChargeablePlaceForCredits(admin, true, "place_1"),
    null,
  );
});

Deno.test("the place has an account but it's not charge-ready -> null", async () => {
  const admin = fakeAdmin({
    place: { credits_enabled: true },
    account: { stripe_account_id: "acct_1", charges_enabled: false, details_submitted: true },
  });
  assertEquals(
    await resolveChargeablePlaceForCredits(admin, true, "place_1"),
    null,
  );
});

Deno.test("full chain ready -> the place + connected account id", async () => {
  const admin = fakeAdmin({
    place: { credits_enabled: true },
    account: { stripe_account_id: "acct_1", charges_enabled: true, details_submitted: true },
  });
  assertEquals(
    await resolveChargeablePlaceForCredits(admin, true, "place_1"),
    { placeId: "place_1", connectedAccountId: "acct_1" },
  );
});

// ── placesAcceptingCredits: the same three legs, for a list ────────────────
// There is no aggregation left to get wrong. MESITA-1674 had to decide
// whether ANY or ALL of an organization's places made the ORG an acceptor;
// with the layer gone (MESITA-1892) a place answers only for itself.

type BulkFixture = {
  acceptors?: { id: string }[];
  accounts?: { place_id: string; charges_enabled: boolean; details_submitted: boolean }[];
};

function fakeBulkAdmin(fx: BulkFixture): SupabaseClient {
  const chain = {
    _table: "",
    select() {
      return this;
    },
    in() {
      return this;
    },
    eq() {
      return this;
    },
    then(resolve: (v: { data: unknown; error: null }) => void) {
      // The query builder is awaited directly (no .maybeSingle()), so this
      // fake is thenable rather than exposing a separate terminal method.
      if (chain._table === "place_profiles") {
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

Deno.test("placesAcceptingCredits: payCredits=false short-circuits before any query", async () => {
  let queried = false;
  const admin = {
    from() {
      queried = true;
      throw new Error("should not query");
    },
  } as unknown as SupabaseClient;
  const out = await placesAcceptingCredits(admin, ["place_1"], false);
  assertEquals([...out], []);
  assertEquals(queried, false);
});

Deno.test("placesAcceptingCredits: empty id list short-circuits too", async () => {
  const admin = { from: () => { throw new Error("should not query"); } } as unknown as SupabaseClient;
  const out = await placesAcceptingCredits(admin, [], true);
  assertEquals([...out], []);
});

Deno.test("placesAcceptingCredits: opted in AND charge-ready is the whole rule", async () => {
  const admin = fakeBulkAdmin({
    // place_2 never opted in, so it is never even asked about an account.
    acceptors: [{ id: "place_1" }],
    accounts: [{ place_id: "place_1", charges_enabled: true, details_submitted: true }],
  });
  const out = await placesAcceptingCredits(admin, ["place_1", "place_2"], true);
  assertEquals([...out], ["place_1"]);
});

Deno.test("placesAcceptingCredits: opting in does not carry a NON-charge-ready place", async () => {
  const admin = fakeBulkAdmin({
    acceptors: [{ id: "place_1" }],
    accounts: [{ place_id: "place_1", charges_enabled: false, details_submitted: true }],
  });
  const out = await placesAcceptingCredits(admin, ["place_1"], true);
  assertEquals([...out], []);
});

Deno.test("placesAcceptingCredits: no accepting place anywhere -> empty, no account query needed", async () => {
  const admin = fakeBulkAdmin({ acceptors: [] });
  const out = await placesAcceptingCredits(admin, ["place_1"], true);
  assertEquals([...out], []);
});

// ── placesHonouringCredits: the SPEND chain (MESITA-2051) ──────────────────
// Literal expectations, never derived from the function under test. The
// failed-query case is the regression this exists for: the spend EF used to
// read a DB error as "not accepted" and answer a guest with a false 409.

function fakeHonourAdmin(
  result: { data?: unknown; error?: { message: string } | null },
  calls: string[] = [],
): SupabaseClient {
  return {
    from(table: string) {
      calls.push(table);
      return {
        select() {
          return this;
        },
        in() {
          return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
        },
      };
    },
  } as unknown as SupabaseClient;
}

Deno.test("honour: credits_enabled places are honoured, others are not", async () => {
  const admin = fakeHonourAdmin({
    data: [
      { id: "place_a", credits_enabled: true },
      { id: "place_b", credits_enabled: false },
      { id: "place_c", credits_enabled: null },
    ],
  });
  const res = await placesHonouringCredits(admin, ["place_a", "place_b", "place_c"], true);
  assertEquals(res.ok, true);
  if (res.ok) assertEquals([...res.honoured], ["place_a"]);
});

Deno.test("honour: a failed query is ok:false with the message, never an empty set", async () => {
  const admin = fakeHonourAdmin({ error: { message: "connection reset" } });
  const res = await placesHonouringCredits(admin, ["place_a"], true);
  assertEquals(res, { ok: false, error: "connection reset" });
});

Deno.test("honour: payCredits off honours nothing and never queries", async () => {
  const calls: string[] = [];
  const res = await placesHonouringCredits(fakeHonourAdmin({}, calls), ["place_a"], false);
  assertEquals(res.ok, true);
  if (res.ok) assertEquals(res.honoured.size, 0);
  assertEquals(calls, []);
});

Deno.test("honour: no place ids honours nothing and never queries", async () => {
  const calls: string[] = [];
  const res = await placesHonouringCredits(fakeHonourAdmin({}, calls), [], true);
  assertEquals(res.ok, true);
  if (res.ok) assertEquals(res.honoured.size, 0);
  assertEquals(calls, []);
});

Deno.test("honour: the spend EF asks the shared predicate, not its own inline read", async () => {
  // One definition of the spend gate. The EF used to read place_profiles
  // inline and ignore the error; read-surface.test.ts no longer allowlists it.
  const src = await Deno.readTextFile(
    new URL("../consumer-web-apply-ticket-credits/index.ts", import.meta.url),
  );
  const code = src.split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
  assertEquals(code.includes("placesHonouringCredits("), true);
  assertEquals(/\.from\(\s*["']place_profiles["']/.test(code), false);
  assertEquals(code.includes("credits_honour_lookup"), true);
});
