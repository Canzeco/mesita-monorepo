// The PLATFORM law as executable tests: the controller + capabilities
// literals are FROZEN — changing them is changing the payments architecture
// (place as merchant of record, direct charges, IFPE shield) and must be a
// deliberate, gated decision, not a drive-by edit.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type Stripe from "npm:stripe@17";
import {
  accountSnapshotFromStripe,
  classifyExistingAccount,
  isMockConnectAccountId,
  keyIsLive,
  MESITA_CONNECT_CAPABILITIES,
  MESITA_CONNECT_CONTROLLER,
  mockConnectAccountId,
} from "./stripe-connect.ts";

Deno.test("PLATFORM law: the controller literal is the typeless-Standard configuration", () => {
  assertEquals(MESITA_CONNECT_CONTROLLER, {
    stripe_dashboard: { type: "full" },
    fees: { payer: "account" },
    losses: { payments: "stripe" },
    requirement_collection: "stripe",
  });
});

Deno.test("PLATFORM law: capabilities are requested explicitly (typeless creation requests nothing implicitly)", () => {
  assertEquals(MESITA_CONNECT_CAPABILITIES, {
    card_payments: { requested: true },
    transfers: { requested: true },
  });
});

Deno.test("mock account ids are stable, per-place, and recognizable", () => {
  const id = mockConnectAccountId("11111111-2222-3333-4444-555555555555");
  assertEquals(id, "mock_acct_11111111-2222-3333-4444-555555555555");
  assert(isMockConnectAccountId(id));
  assert(!isMockConnectAccountId("acct_1ABC"));
});

Deno.test("keyIsLive reads the secret prefix only", () => {
  assert(keyIsLive("sk_live_abc"));
  assert(!keyIsLive("sk_test_abc"));
  assert(!keyIsLive(""));
});

Deno.test("snapshot mapper: livemode is explicit; optional/null requirements default safe", () => {
  const bare = accountSnapshotFromStripe(
    { id: "acct_1", charges_enabled: false } as unknown as Stripe.Account,
    false,
  );
  assertEquals(bare, {
    charges_enabled: false,
    details_submitted: false,
    payouts_enabled: false,
    requirements_due: [],
    disabled_reason: null,
    livemode: false,
  });

  const full = accountSnapshotFromStripe(
    {
      id: "acct_2",
      charges_enabled: true,
      details_submitted: true,
      payouts_enabled: true,
      requirements: {
        currently_due: ["external_account", "business_profile.url"],
        disabled_reason: "requirements.past_due",
      },
    } as unknown as Stripe.Account,
    true,
  );
  assertEquals(full.charges_enabled, true);
  assertEquals(full.requirements_due, ["external_account", "business_profile.url"]);
  assertEquals(full.disabled_reason, "requirements.past_due");
  assertEquals(full.livemode, true);

  const nullDue = accountSnapshotFromStripe(
    {
      id: "acct_3",
      requirements: { currently_due: null, disabled_reason: null },
    } as unknown as Stripe.Account,
    false,
  );
  assertEquals(nullDue.requirements_due, []);
});

Deno.test("transition law: mock never overwrites real; real replaces mock; universe mismatch replaceable", () => {
  const mockRow = { stripe_account_id: "mock_acct_p1", livemode: false };
  const testRow = { stripe_account_id: "acct_1", livemode: false };
  const liveRow = { stripe_account_id: "acct_2", livemode: true };

  // No row.
  assertEquals(classifyExistingAccount(null, { mockMode: true, keyLive: false }), "create");
  assertEquals(classifyExistingAccount(null, { mockMode: false, keyLive: false }), "create");
  // Mock mode: reuse mock, NEVER touch real.
  assertEquals(classifyExistingAccount(mockRow, { mockMode: true, keyLive: false }), "use");
  assertEquals(
    classifyExistingAccount(testRow, { mockMode: true, keyLive: false }),
    "return_untouched",
  );
  // Real mode: mock row treated as absent.
  assertEquals(classifyExistingAccount(mockRow, { mockMode: false, keyLive: false }), "replace");
  // Real mode, matching universe: use.
  assertEquals(classifyExistingAccount(testRow, { mockMode: false, keyLive: false }), "use");
  assertEquals(classifyExistingAccount(liveRow, { mockMode: false, keyLive: true }), "use");
  // Universe mismatch (rotated sandbox / live cutover): replaceable.
  assertEquals(classifyExistingAccount(testRow, { mockMode: false, keyLive: true }), "replace");
  assertEquals(classifyExistingAccount(liveRow, { mockMode: false, keyLive: false }), "replace");
});
