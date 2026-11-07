// Business › Payments (MESITA-3296): the money posture is one literal, and the
// state a page shows is a pure read of the row. Money and auth, so pinned.

import { assertEquals } from "jsr:@std/assert@1";
import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  accountState,
  accountView,
  chargesEnabledByPlace,
  CONNECT_CONTROLLER,
  CONNECT_CONTROLLER_NO_DASHBOARD,
  connectApiVersion,
  isDashboardPairRefusal,
  isPaymentKey,
  settingsFromRow,
  snapshotFromStripe,
} from "./payments.ts";

Deno.test("the place pays Stripe, Stripe bears losses and collects, whatever the dashboard", () => {
  for (const c of [CONNECT_CONTROLLER, CONNECT_CONTROLLER_NO_DASHBOARD]) {
    assertEquals(c.fees.payer, "account");
    assertEquals(c.losses.payments, "stripe");
    assertEquals(c.requirement_collection, "stripe");
  }
  assertEquals(CONNECT_CONTROLLER.stripe_dashboard.type, "express");
  assertEquals(CONNECT_CONTROLLER_NO_DASHBOARD.stripe_dashboard.type, "none");
});

Deno.test("the Connect API version is the preview unless a secret overrides it", () => {
  assertEquals(connectApiVersion(() => undefined), "2026-06-24.preview");
  assertEquals(connectApiVersion(() => "  "), "2026-06-24.preview");
  assertEquals(connectApiVersion(() => "2026-10-01.preview"), "2026-10-01.preview");
});

Deno.test("only the dashboard pair refusal is retried without a dashboard", () => {
  assertEquals(isDashboardPairRefusal("When stripe_dashboard[type]=express, your platform must collect fees and be liable"), true);
  assertEquals(isDashboardPairRefusal("Invalid API Key provided"), false);
});

Deno.test("the account's state is one of four words", () => {
  assertEquals(accountState(null), "none");
  assertEquals(accountState({ charges_enabled: false, details_submitted: false, disabled_reason: null }), "onboarding");
  assertEquals(accountState({ charges_enabled: false, details_submitted: true, disabled_reason: null }), "restricted");
  assertEquals(accountState({ charges_enabled: false, details_submitted: false, disabled_reason: "requirements.past_due" }), "restricted");
  assertEquals(accountState({ charges_enabled: true, details_submitted: true, disabled_reason: null }), "ready");
});

Deno.test("the page never gets the account id or Stripe's words", () => {
  const view = accountView({
    place_id: "p",
    stripe_account_id: "acct_1",
    livemode: false,
    account_country: "MX",
    charges_enabled: false,
    details_submitted: true,
    payouts_enabled: false,
    requirements_due: ["external_account", "individual.id_number"],
    disabled_reason: "requirements.past_due",
  });
  assertEquals(view, {
    state: "restricted",
    livemode: false,
    country: "MX",
    charges_enabled: false,
    payouts_enabled: false,
    details_submitted: true,
    requirements_due: 2,
  });
  assertEquals("stripe_account_id" in view, false);
});

Deno.test("Stripe's Account object becomes the row, missing fields read as off", () => {
  assertEquals(snapshotFromStripe({}, false), {
    livemode: false,
    account_country: null,
    charges_enabled: false,
    details_submitted: false,
    payouts_enabled: false,
    requirements_due: [],
    disabled_reason: null,
  });
  const s = snapshotFromStripe({ country: "MX", charges_enabled: true, requirements: { currently_due: ["a", 1], disabled_reason: null } }, false);
  assertEquals(s.charges_enabled, true);
  assertEquals(s.requirements_due, ["a"]);
});

Deno.test("settings: ten switches; no row is products off and ways to pay on; unknown keys refused", () => {
  const off = settingsFromRow(null);
  assertEquals(Object.keys(off).length, 10);
  assertEquals(Object.entries(off).filter(([k]) => !k.startsWith("pay_")).every(([, v]) => v === false), true);
  // Ways to pay (MESITA-3396) default on, and only an outright false turns one off:
  // a row from before the column must never switch a place off.
  assertEquals(off.pay_cash, true);
  assertEquals(off.pay_cards, true);
  assertEquals(off.pay_credits, true);
  assertEquals(settingsFromRow({ cashback: true }).pay_credits, true);
  assertEquals(settingsFromRow({ pay_credits: false }).pay_credits, false);
  assertEquals(settingsFromRow({ pay_cards: "no" }).pay_cards, true);
  assertEquals(settingsFromRow({ cashback: true, voucher_vip: "yes" }).cashback, true);
  assertEquals(settingsFromRow({ cashback: true, voucher_vip: "yes" }).voucher_vip, false);
  assertEquals(isPaymentKey("voucher_200"), true);
  assertEquals(isPaymentKey("prepay_enabled"), false);
});

// The "Stripe" general state and the guest Pay mark read one rule
// (MESITA-3394): charging, in the server's Stripe mode; a failed read is
// "unknown" (null), never "no". A chain fake stands in for PostgREST.
function accountsFake(result: { data: unknown[] | null; error: { message: string } | null }) {
  const calls = { in: 0 };
  const client = {
    from: () => ({ select: () => ({ in: () => { calls.in++; return Promise.resolve(result); } }) }),
  } as unknown as SupabaseClient;
  return { client, calls };
}

Deno.test("chargesEnabledByPlace: only charging accounts in the requested Stripe mode", async () => {
  const { client } = accountsFake({
    data: [
      { place_id: "a", charges_enabled: true, livemode: false },
      { place_id: "b", charges_enabled: true, livemode: true },
      { place_id: "c", charges_enabled: false, livemode: false },
    ],
    error: null,
  });
  assertEquals(await chargesEnabledByPlace(client, ["a", "b", "c", "d"], false), new Set(["a"]));
  assertEquals(await chargesEnabledByPlace(client, ["a", "b", "c", "d"], true), new Set(["b"]));
});

Deno.test("chargesEnabledByPlace: no ids reads nothing; a failed read is null, not empty", async () => {
  const empty = accountsFake({ data: [], error: null });
  assertEquals(await chargesEnabledByPlace(empty.client, [], false), new Set());
  assertEquals(empty.calls.in, 0);
  const failed = accountsFake({ data: null, error: { message: "boom" } });
  assertEquals(await chargesEnabledByPlace(failed.client, ["a"], false), null);
});
