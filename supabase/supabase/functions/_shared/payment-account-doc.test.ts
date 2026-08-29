// The payment-account write door: validators are the law. The two-belt
// exhaustiveness lives in the module's types; these tests pin the runtime
// half — unknown/malformed keys bounce, the patch-key set matches the row,
// and the update door detects zero-row no-ops instead of succeeding silently.

import { assert, assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  isConnectChargeReady,
  PAYMENT_ACCOUNT_PATCH_KEYS,
  validatePaymentAccountPatch,
  writePaymentAccount,
} from "./payment-account-doc.ts";

Deno.test("patch keys cover exactly the mutable columns", () => {
  assertEquals([...PAYMENT_ACCOUNT_PATCH_KEYS], [
    "stripe_account_id",
    "livemode",
    "charges_enabled",
    "details_submitted",
    "payouts_enabled",
    "requirements_due",
    "disabled_reason",
  ]);
});

Deno.test("validate: accepts a full snapshot patch", () => {
  const res = validatePaymentAccountPatch({
    stripe_account_id: "acct_1",
    livemode: false,
    charges_enabled: true,
    details_submitted: true,
    payouts_enabled: false,
    requirements_due: ["external_account"],
    disabled_reason: null,
  });
  assert(res.ok);
});

Deno.test("validate: rejects unknown and malformed fields loudly", () => {
  const unknown = validatePaymentAccountPatch({ place_id: "p1" });
  assert(!unknown.ok);
  assertEquals(unknown.error, "unknown payment account field: place_id");

  const badBool = validatePaymentAccountPatch({ charges_enabled: "yes" });
  assert(!badBool.ok);
  assertEquals(badBool.error, "charges_enabled must be a boolean");

  const badDue = validatePaymentAccountPatch({ requirements_due: [1] });
  assert(!badDue.ok);
  assertEquals(badDue.error, "requirements_due must be an array of strings");

  const emptyId = validatePaymentAccountPatch({ stripe_account_id: "  " });
  assert(!emptyId.ok);

  const notObject = validatePaymentAccountPatch(null);
  assert(!notObject.ok);
});

// Minimal PostgREST-shaped fake: enough surface for the door's two paths.
function fakeAdmin(result: { data: unknown; error: { message: string } | null }) {
  const chain = {
    insert: () => chain,
    update: () => chain,
    eq: () => chain,
    select: () => chain,
    maybeSingle: () => Promise.resolve(result),
    from: () => chain,
  };
  return { from: () => chain } as unknown as SupabaseClient;
}

Deno.test("door: zero-row update is a DETECTED no-op (ok, row null), never a silent success", async () => {
  const res = await writePaymentAccount(
    fakeAdmin({ data: null, error: null }),
    {
      mode: "update",
      by: "stripe_account_id",
      id: "acct_unknown",
      patch: { charges_enabled: true },
    },
  );
  assert(res.ok);
  assertEquals(res.row, null);
});

Deno.test("door: db errors and invalid patches fail loudly", async () => {
  const dbErr = await writePaymentAccount(
    fakeAdmin({ data: null, error: { message: "boom" } }),
    { mode: "update", by: "place_id", id: "p1", patch: { livemode: true } },
  );
  assert(!dbErr.ok);

  const badPatch = await writePaymentAccount(
    fakeAdmin({ data: null, error: null }),
    { mode: "update", by: "place_id", id: "p1", patch: { nope: 1 } as never },
  );
  assert(!badPatch.ok);
});

Deno.test("charge-ready = charges_enabled ∧ details_submitted; payouts excluded; null row never ready", () => {
  assert(
    isConnectChargeReady({ charges_enabled: true, details_submitted: true }),
  );
  assert(
    !isConnectChargeReady({ charges_enabled: true, details_submitted: false }),
  );
  assert(
    !isConnectChargeReady({ charges_enabled: false, details_submitted: true }),
  );
  assert(!isConnectChargeReady(null));
});
