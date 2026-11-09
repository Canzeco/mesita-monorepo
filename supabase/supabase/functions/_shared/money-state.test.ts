// MESITA-3302 — moneyState, one outcome per case. It gates selling, so
// pinned under the money rule.

import { assertEquals } from "jsr:@std/assert@1";
import { CARD_BILL_PAY_LIVE, type MoneySettings, moneyState } from "./money-state.ts";

const off: MoneySettings = {
  cashback: false,
  voucher_200: false,
  voucher_1000: false,
  voucher_5000: false,
  voucher_welcome: false,
  voucher_story: false,
  voucher_vip: false,
};
const allOn: MoneySettings = {
  cashback: true,
  voucher_200: true,
  voucher_1000: true,
  voucher_5000: true,
  voucher_welcome: true,
  voucher_story: true,
  voucher_vip: true,
};
const can = { charges_enabled: true };
const cannot = { charges_enabled: false };

Deno.test("a switch on with charges_enabled sells, every voucher since MESITA-3550", () => {
  const s = moneyState(allOn, can, null);
  assertEquals(s.sell, ["voucher_200", "voucher_1000", "voucher_5000", "voucher_welcome", "voucher_story", "voucher_vip"]);
  assertEquals(s.unavailable, {});
  assertEquals(s.cashback, true);
});

Deno.test("a switch on without charges_enabled sells nothing and says the account is missing", () => {
  const s = moneyState(allOn, cannot, null);
  assertEquals(s.sell, []);
  assertEquals(s.unavailable.voucher_200, "needs_account");
  assertEquals(s.cashback, false);
  assertEquals(moneyState(allOn, null, null).unavailable.voucher_1000, "needs_account");
});

Deno.test("a switch off is off, whatever the account", () => {
  const s = moneyState(off, can, null);
  assertEquals(s.sell, []);
  assertEquals(s.unavailable.voucher_200, "off");
  assertEquals(s.cashback, false);
});

Deno.test("Pay by phone off (MESITA-3396) drops card pay and cashback, never the vouchers", () => {
  const noCards = { ...allOn, pay_cards: false };
  assertEquals(moneyState(noCards, can, { spendable_cents: 100 }).pay, "credit");
  assertEquals(moneyState(noCards, can, null).pay, "none");
  assertEquals(moneyState(noCards, can, null).cashback, false);
  assertEquals(moneyState(noCards, can, null).sell, ["voucher_200", "voucher_1000", "voucher_5000", "voucher_welcome", "voucher_story", "voucher_vip"]);
  // Absent reads on: a reader from before the column is unchanged.
  assertEquals(moneyState(allOn, can, { spendable_cents: 100 }).pay, "both");
});

Deno.test("credit is the place's debt (MESITA-3408): every switch off, no account, credit still spends", () => {
  const everythingOff = { ...off, pay_cards: false };
  assertEquals(moneyState(everythingOff, null, { spendable_cents: 100 }).pay, "credit");
  assertEquals(moneyState(everythingOff, can, { spendable_cents: 100 }).pay, "credit");
});

Deno.test("cashback needs its own switch and Pay by phone with a charging account", () => {
  assertEquals(moneyState({ ...off, cashback: true }, can, null).cashback, true);
  assertEquals(moneyState({ ...off, cashback: true, pay_cards: false }, can, null).cashback, false);
  assertEquals(moneyState({ ...off, cashback: true }, cannot, null).cashback, false);
  assertEquals(moneyState(off, can, null).cashback, false);
});

Deno.test("the green mark (MESITA-3408): on when a guest can pay the bill by card here or buy a voucher", () => {
  assertEquals(CARD_BILL_PAY_LIVE, true);
  // Pay by phone on with a charging account: card bill pay, mark on.
  assertEquals(moneyState(off, can, null).mesita_pay, true);
  // A sellable voucher lights it, even with Pay by phone off.
  assertEquals(moneyState({ ...off, voucher_200: true, pay_cards: false }, can, null).mesita_pay, true);
  // Pay by phone off and nothing selling: off.
  assertEquals(moneyState({ ...off, cashback: true, pay_cards: false }, can, null).mesita_pay, false);
  // MX$5,000 and VIP sell since MESITA-3550, so they light it.
  assertEquals(moneyState({ ...off, pay_cards: false, voucher_5000: true }, can, null).mesita_pay, true);
  // Story sells since MESITA-3507, so it lights it.
  assertEquals(moneyState({ ...off, pay_cards: false, voucher_story: true }, can, null).mesita_pay, true);
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
