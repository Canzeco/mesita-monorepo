// Business › Payments (MESITA-3296): the money posture is one literal, and the
// state a page shows is a pure read of the row. Money and auth, so pinned.

import { assertEquals } from "jsr:@std/assert@1";
import {
  accountState,
  accountView,
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
    country: "MX",
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
    country: null,
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

Deno.test("settings: seven switches, no row is all off, unknown keys refused", () => {
  const off = settingsFromRow(null);
  assertEquals(Object.keys(off).length, 7);
  assertEquals(Object.values(off).every((v) => v === false), true);
  assertEquals(settingsFromRow({ cashback: true, voucher_vip: "yes" }).cashback, true);
  assertEquals(settingsFromRow({ cashback: true, voucher_vip: "yes" }).voucher_vip, false);
  assertEquals(isPaymentKey("voucher_200"), true);
  assertEquals(isPaymentKey("prepay_enabled"), false);
});
