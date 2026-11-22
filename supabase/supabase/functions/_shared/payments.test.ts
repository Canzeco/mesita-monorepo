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
  cardsAccepted,
  listRowMoney,
  settingsFromRow,
  snapshotFromStripe,
  stripeStateByPlace,
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
    stage: "restricted",
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

Deno.test("settings: no row is everything Off, App Payments included; unknown keys refused", () => {
  const off = settingsFromRow(null);
  // Eleven switches and four rates (credit and prepay since MESITA-3827;
  // Accept Stripe Payments since MESITA-3946, On by default like its column).
  // Ten since the VIP offer left (MESITA-4249); nine since Welcome left
  // (MESITA-4636); ten again with VIP back (MESITA-4640); nine since Story
  // left (MESITA-4642).
  assertEquals(Object.keys(off).length, 9);
  assertEquals(off.stripe_payments, true);
  assertEquals(settingsFromRow({ stripe_payments: false }).stripe_payments, false);
  // Mesita Prepayments (MESITA-3597) reads off with no row and from anything but true.
  assertEquals(off.prepayments, false);
  assertEquals(settingsFromRow({ prepayments: "yes" }).prepayments, false);
  assertEquals(isPaymentKey("prepayments"), true);
  assertEquals(Object.entries(off).filter(([k]) => k !== "stripe_payments").every(([, v]) => v === false), true);
  // Mesita Payments (MESITA-3599) is Off with no row and On only on an outright
  // true: it needs a Stripe account that takes cards, which no row can say.
  assertEquals(off.pay_cards, false);
  assertEquals(settingsFromRow({ pay_cards: true }).pay_cards, true);
  assertEquals(settingsFromRow({ pay_cards: "yes" }).pay_cards, false);
  assertEquals(settingsFromRow({ loyalty_cards: true, voucher_vip: "yes" }).loyalty_cards, true);
  assertEquals(settingsFromRow({ loyalty_cards: true, voucher_vip: "yes" }).voucher_vip, false);
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
  // No settings row, charging account: Mesita Payments is Off until the owner
  // turns it on (MESITA-3599), so no mark.
  assertEquals(listRowMoney(undefined, true), { sell: [], mesita_pay: false });
  // No charging account: nothing.
  assertEquals(listRowMoney({ ...settingsFromRow(null), loyalty_cards: true, voucher_200: true }, false), { sell: [], mesita_pay: false });
  // Pay by phone off, MX$200 on with Loyalty Cards, charging: sells and shows the mark.
  assertEquals(listRowMoney({ ...settingsFromRow(null), loyalty_cards: true, prepayments: true, pay_cards: false, voucher_200: true }, true), { sell: ["voucher_200"], mesita_pay: true });
  // Mesita Prepayments Off (MESITA-3597): the voucher's own switch alone sells nothing.
  assertEquals(listRowMoney({ ...settingsFromRow(null), loyalty_cards: true, pay_cards: false, voucher_200: true }, true).sell, []);
  // Pay by phone off, nothing on: no mark.
  assertEquals(listRowMoney({ ...settingsFromRow(null), pay_cards: false, loyalty_cards: true }, true), { sell: [], mesita_pay: false });
  // Accept Stripe Payments Off (MESITA-3946): no card pay, no voucher, no mark.
  assertEquals(
    listRowMoney({ ...settingsFromRow(null), stripe_payments: false, loyalty_cards: true, prepayments: true, pay_cards: true, voucher_200: true }, true),
    { sell: [], mesita_pay: false },
  );
  assertEquals(cardsAccepted({ pay_cards: true, stripe_payments: false }), false);
  assertEquals(cardsAccepted({ pay_cards: true }), true);
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

// The admin Stripe filter (MESITA-3395) reads three states off the same rows
// and the same in-mode rule, so "charging" there is the guest Pay mark here.
Deno.test("stripeStateByPlace: none · onboarding · charging in the requested mode", async () => {
  const { client } = accountsFake({
    data: [
      { place_id: "a", charges_enabled: true, livemode: false },
      { place_id: "b", charges_enabled: true, livemode: true },
      { place_id: "c", charges_enabled: false, livemode: false },
    ],
    error: null,
  });
  assertEquals(
    await stripeStateByPlace(client, ["a", "b", "c", "d"], false),
    new Map([["a", "charging"], ["b", "none"], ["c", "onboarding"], ["d", "none"]]),
  );
  const failed = accountsFake({ data: null, error: { message: "boom" } });
  assertEquals(await stripeStateByPlace(failed.client, ["a"], false), null);
});
