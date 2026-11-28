// MESITA-3302 — moneyState, one outcome per case. It gates selling, so
// pinned under the money rule.

import { assertEquals } from "jsr:@std/assert@1";
import { type MoneySettings, moneyState } from "./money-state.ts";

const off: MoneySettings = {
  voucher_welcome: false,
  voucher_200: false,
  voucher_1000: false,
  voucher_5000: false,
  voucher_vip: false,
};
const allOn: MoneySettings = {
  loyalty_cards: true,
  cash_payments: true,
  has_place_code: true,
  voucher_welcome: true,
  voucher_200: true,
  voucher_1000: true,
  voucher_5000: true,
  voucher_vip: true,
};
const can = { charges_enabled: true };
const cannot = { charges_enabled: false };

Deno.test("a switch on with charges_enabled sells: Welcome, Small, Medium, Big (MESITA-5124: Welcome is a voucher again; VIP stays off)", () => {
  const s = moneyState(allOn, can, null);
  assertEquals(s.sell, ["voucher_welcome", "voucher_200", "voucher_1000", "voucher_5000"]);
  assertEquals(s.unavailable, { voucher_vip: "off" });
  // Welcome is the owner's own switch, like every size.
  assertEquals(moneyState({ ...allOn, voucher_welcome: false }, can, null).unavailable.voucher_welcome, "off");
});

Deno.test("App Prepayments Off (MESITA-3597) sells no voucher, whatever the voucher switches read; absent reads on", () => {
  const s = moneyState({ ...allOn, prepayments: false }, can, null);
  assertEquals(s.sell, []);
  assertEquals(s.unavailable.voucher_200, "off");
  assertEquals(moneyState({ ...allOn, prepayments: true }, can, null).sell.length, 4);
});

Deno.test("a switch on without charges_enabled sells nothing and says the account is missing", () => {
  const s = moneyState(allOn, cannot, null);
  assertEquals(s.sell, []);
  assertEquals(s.unavailable.voucher_200, "needs_account");
  assertEquals(moneyState(allOn, null, null).unavailable.voucher_1000, "needs_account");
});

Deno.test("a switch off is off, whatever the account", () => {
  const s = moneyState(off, can, null);
  assertEquals(s.sell, []);
  assertEquals(s.unavailable.voucher_200, "off");
});

Deno.test("Pay by phone off (MESITA-3396) drops card pay, never the vouchers", () => {
  const noCards = { ...allOn, pay_cards: false };
  assertEquals(moneyState(noCards, can, { spendable_cents: 100 }).pay, "credit");
  assertEquals(moneyState(noCards, can, null).pay, "none");
  assertEquals(moneyState(noCards, can, null).sell, ["voucher_welcome", "voucher_200", "voucher_1000", "voucher_5000"]);
  // Absent reads on: a reader from before the column is unchanged.
  assertEquals(moneyState(allOn, can, { spendable_cents: 100 }).pay, "both");
});

Deno.test("credit is the place's debt (MESITA-3408): every switch off, no account, credit still spends", () => {
  const everythingOff = { ...off, pay_cards: false };
  assertEquals(moneyState(everythingOff, null, { spendable_cents: 100 }).pay, "credit");
  assertEquals(moneyState(everythingOff, can, { spendable_cents: 100 }).pay, "credit");
});

Deno.test("cash (MESITA-3589, MESITA-4485): Cash Payments needs the switch, not a waiter code", () => {
  const cash = { ...off, cash_payments: true, has_place_code: true };
  assertEquals(moneyState(cash, null, null).cash, true);
  assertEquals(moneyState({ ...cash, has_place_code: false }, null, null).cash, true);
  assertEquals(moneyState({ ...cash, cash_payments: false }, null, null).cash, false);
});

Deno.test("Prepayments (MESITA-3589) need Loyalty Cards and Billing paid up", () => {
  assertEquals(moneyState({ ...allOn, loyalty_cards: false }, can, null).unavailable.voucher_200, "needs_loyalty_cards");
  assertEquals(moneyState(allOn, { charges_enabled: true, fee_hold: true }, null).unavailable.voucher_200, "needs_billing");
  assertEquals(moneyState(allOn, { charges_enabled: true, fee_hold: true }, null).sell, []);
});

Deno.test("Loyalty Cards Off never stops a guest spending what they hold", () => {
  const nothing = { ...off, pay_cards: false };
  assertEquals(moneyState(nothing, null, { spendable_cents: 500 }).pay, "credit");
  assertEquals(moneyState(nothing, null, { spendable_cents: 500 }).loyalty_cards, false);
});

Deno.test("the green mark (MESITA-3408): on when a guest can buy a voucher; card bill pay is gone (MESITA-4708)", () => {
  // Pay by phone on with a charging account no longer lights it: no card for a bill.
  assertEquals(moneyState(off, can, null).mesita_pay, false);
  // A sellable voucher lights it, even with Pay by phone off.
  assertEquals(moneyState({ ...off, loyalty_cards: true, voucher_200: true, pay_cards: false }, can, null).mesita_pay, true);
  // Pay by phone off and nothing selling: off.
  assertEquals(moneyState({ ...off, loyalty_cards: true, pay_cards: false }, can, null).mesita_pay, false);
  // Medium (voucher_5000) sells again (MESITA-4056): its switch alone lights it.
  assertEquals(moneyState({ ...off, loyalty_cards: true, pay_cards: false, voucher_5000: true }, can, null).mesita_pay, true);
  // No account: no mark.
  assertEquals(moneyState(allOn, null, null).mesita_pay, false);
  assertEquals(moneyState(allOn, cannot, null).mesita_pay, false);
});

Deno.test("pay: both with a balance and an account, credit with a balance only, card with an account only, else none", () => {
  assertEquals(moneyState(off, can, { spendable_cents: 100 }).pay, "both");
  assertEquals(moneyState(off, cannot, { spendable_cents: 100 }).pay, "credit");
  assertEquals(moneyState(off, can, { spendable_cents: 0 }).pay, "card");
  assertEquals(moneyState(off, can, null).pay, "card");
  assertEquals(moneyState(off, null, null).pay, "none");
});

Deno.test("fee_hold (MESITA-3461): an unpaid fee invoice turns cards and (MESITA-3589) vouchers off, credit still pays", () => {
  const held = moneyState(allOn, { charges_enabled: true, fee_hold: true }, { spendable_cents: 100 });
  assertEquals(held.pay, "credit");
  assertEquals(held.sell.includes("voucher_200"), false);
  assertEquals(held.unavailable.voucher_200, "needs_billing");
  assertEquals(moneyState(allOn, { charges_enabled: true, fee_hold: true }, null).pay, "none");
  assertEquals(moneyState(allOn, { charges_enabled: true, fee_hold: false }, null).pay, "card");
});
