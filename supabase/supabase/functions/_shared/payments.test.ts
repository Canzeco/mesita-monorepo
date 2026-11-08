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
  listRowMoney,
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

Deno.test("settings: eight switches; no row is products off and Pay by phone on; unknown keys refused", () => {
  const off = settingsFromRow(null);
  assertEquals(Object.keys(off).length, 8);
  assertEquals(Object.entries(off).filter(([k]) => k !== "pay_cards").every(([, v]) => v === false), true);
  // Pay by phone (MESITA-3396) defaults on, and only an outright false turns it
  // off: a row from before the column must never switch a place off.
  assertEquals(off.pay_cards, true);
  assertEquals(settingsFromRow({ pay_cards: false }).pay_cards, false);
  assertEquals(settingsFromRow({ pay_cards: "no" }).pay_cards, true);
  assertEquals(settingsFromRow({ cashback: true, voucher_vip: "yes" }).cashback, true);
  assertEquals(settingsFromRow({ cashback: true, voucher_vip: "yes" }).voucher_vip, false);
  // A row still carrying the dead columns (MESITA-3408, dropped by MESITA-3409) reads past them.
  const old = settingsFromRow({ pay_cash: false, pay_credits: false, voucher_200: true } as Record<string, unknown>);
  assertEquals("pay_cash" in old || "pay_credits" in old, false);
  assertEquals(old.voucher_200, true);
  assertEquals(isPaymentKey("voucher_200"), true);
  assertEquals(isPaymentKey("prepay_enabled"), false);
  // A stale Payments tab can still send these; set-payment answers unknown_switch.
  assertEquals(isPaymentKey("pay_cash"), false);
  assertEquals(isPaymentKey("pay_credits"), false);
});

Deno.test("list rows (MESITA-3408): the mark lights where a guest can pay by card or buy a voucher", () => {
  // No settings row, charging account: Pay by phone defaults on, so card bill pay, mark on.
  assertEquals(listRowMoney(undefined, true), { sell: [], mesita_pay: true });
  // No charging account: nothing.
  assertEquals(listRowMoney({ ...settingsFromRow(null), voucher_200: true }, false), { sell: [], mesita_pay: false });
  // Pay by phone off, MX$200 on, charging: sells and shows the mark.
  assertEquals(listRowMoney({ ...settingsFromRow(null), pay_cards: false, voucher_200: true }, true), { sell: ["voucher_200"], mesita_pay: true });
  // Pay by phone off, nothing on: no mark.
  assertEquals(listRowMoney({ ...settingsFromRow(null), pay_cards: false, cashback: true }, true), { sell: [], mesita_pay: false });
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
