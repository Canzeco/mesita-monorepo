// MESITA-3302 — moneyState, one outcome per case. It gates selling, so
// pinned under the money rule.

import { assertEquals } from "jsr:@std/assert@1";
import { CARD_BILL_PAY_LIVE, type MoneySettings, moneyState } from "./money-state.ts";

const off: MoneySettings = {
  voucher_200: false,
  voucher_1000: false,
  voucher_5000: false,
  voucher_welcome: false,
  voucher_story: false,
  voucher_vip: false,
};
const allOn: MoneySettings = {
  house_credits: true,
  cash_payments: true,
  card_cashback_bps: 500,
  cash_cashback_bps: 200,
  has_place_code: true,
  voucher_200: true,
  voucher_1000: true,
  voucher_5000: true,
  voucher_welcome: true,
  voucher_story: true,
  voucher_vip: true,
};
const can = { charges_enabled: true };
const cannot = { charges_enabled: false };

Deno.test("a switch on with charges_enabled sells; Story is parked (MESITA-3831, VIP back in MESITA-3833)", () => {
  const s = moneyState(allOn, can, null);
  assertEquals(s.sell, ["voucher_200", "voucher_1000", "voucher_5000", "voucher_welcome", "voucher_vip"]);
  assertEquals(s.unavailable, { voucher_story: "not_yet" });
  assertEquals(s.cashback, true);
});

Deno.test("Mesita Prepayments Off (MESITA-3597) sells no voucher, whatever the voucher switches read; absent reads on", () => {
  const s = moneyState({ ...allOn, prepayments: false }, can, null);
  assertEquals(s.sell, []);
  assertEquals(s.unavailable.voucher_200, "off");
  assertEquals(moneyState({ ...allOn, prepayments: true }, can, null).sell.length, 5);
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
  assertEquals(moneyState(noCards, can, null).sell, ["voucher_200", "voucher_1000", "voucher_5000", "voucher_welcome", "voucher_vip"]);
  // Absent reads on: a reader from before the column is unchanged.
  assertEquals(moneyState(allOn, can, { spendable_cents: 100 }).pay, "both");
});

Deno.test("credit is the place's debt (MESITA-3408): every switch off, no account, credit still spends", () => {
  const everythingOff = { ...off, pay_cards: false };
  assertEquals(moneyState(everythingOff, null, { spendable_cents: 100 }).pay, "credit");
  assertEquals(moneyState(everythingOff, can, { spendable_cents: 100 }).pay, "credit");
});

Deno.test("card cashback (MESITA-3589): the place's own rate, needs House Credits and Mesita Payments with a charging account", () => {
  const on = { ...off, house_credits: true, card_cashback_bps: 700 };
  assertEquals(moneyState(on, can, null).card_cashback_bps, 700);
  assertEquals(moneyState(on, can, null).cashback, true);
  assertEquals(moneyState({ ...on, pay_cards: false }, can, null).card_cashback_bps, 0);
  assertEquals(moneyState(on, cannot, null).card_cashback_bps, 0);
  assertEquals(moneyState(on, { charges_enabled: true, fee_hold: true }, null).card_cashback_bps, 0);
  // House Credits Off: no new credit, so no cashback.
  assertEquals(moneyState({ ...on, house_credits: false }, can, null).card_cashback_bps, 0);
  // Off (null) is off.
  assertEquals(moneyState({ ...on, card_cashback_bps: null }, can, null).cashback, false);
});

Deno.test("cash (MESITA-3589): Cash Payments needs the switch and the place code; its cashback needs House Credits too, no Stripe", () => {
  const cash = { ...off, cash_payments: true, has_place_code: true };
  assertEquals(moneyState(cash, null, null).cash, true);
  assertEquals(moneyState(cash, null, null).cash_cashback_bps, 0);
  assertEquals(moneyState({ ...cash, has_place_code: false }, null, null).cash, false);
  assertEquals(moneyState({ ...cash, cash_payments: false }, null, null).cash, false);
  const back = { ...cash, house_credits: true, cash_cashback_bps: 300 };
  assertEquals(moneyState(back, null, null).cash_cashback_bps, 300);
  assertEquals(moneyState(back, null, null).outside_cashback, true);
  assertEquals(moneyState({ ...back, house_credits: false }, null, null).cash_cashback_bps, 0);
});

Deno.test("Prepayments (MESITA-3589) need House Credits and Billing paid up", () => {
  assertEquals(moneyState({ ...allOn, house_credits: false }, can, null).unavailable.voucher_200, "needs_house_credits");
  assertEquals(moneyState(allOn, { charges_enabled: true, fee_hold: true }, null).unavailable.voucher_200, "needs_billing");
  assertEquals(moneyState(allOn, { charges_enabled: true, fee_hold: true }, null).sell, []);
});

Deno.test("House Credits Off never stops a guest spending what they hold", () => {
  const nothing = { ...off, pay_cards: false };
  assertEquals(moneyState(nothing, null, { spendable_cents: 500 }).pay, "credit");
  assertEquals(moneyState(nothing, null, { spendable_cents: 500 }).house_credits, false);
});

Deno.test("the green mark (MESITA-3408): on when a guest can pay the bill by card here or buy a voucher", () => {
  assertEquals(CARD_BILL_PAY_LIVE, true);
  // Pay by phone on with a charging account: card bill pay, mark on.
  assertEquals(moneyState(off, can, null).mesita_pay, true);
  // A sellable voucher lights it, even with Pay by phone off.
  assertEquals(moneyState({ ...off, house_credits: true, voucher_200: true, pay_cards: false }, can, null).mesita_pay, true);
  // Pay by phone off and nothing selling: off.
  assertEquals(moneyState({ ...off, house_credits: true, card_cashback_bps: 500, pay_cards: false }, can, null).mesita_pay, false);
  // MX$5,000 and VIP sell since MESITA-3550, so they light it.
  assertEquals(moneyState({ ...off, house_credits: true, pay_cards: false, voucher_5000: true }, can, null).mesita_pay, true);
  // Story is parked (MESITA-3831): its switch alone sells nothing, no mark.
  assertEquals(moneyState({ ...off, house_credits: true, pay_cards: false, voucher_story: true }, can, null).mesita_pay, false);
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

Deno.test("fee_hold (MESITA-3461): an unpaid fee invoice turns cards, cashback and (MESITA-3589) vouchers off, credit still pays", () => {
  const held = moneyState(allOn, { charges_enabled: true, fee_hold: true }, { spendable_cents: 100 });
  assertEquals(held.pay, "credit");
  assertEquals(held.cashback, false);
  assertEquals(held.sell.includes("voucher_200"), false);
  assertEquals(held.unavailable.voucher_200, "needs_billing");
  assertEquals(moneyState(allOn, { charges_enabled: true, fee_hold: true }, null).pay, "none");
  assertEquals(moneyState(allOn, { charges_enabled: true, fee_hold: false }, null).pay, "card");
});

Deno.test("MESITA-3827: Credits Payments Cashback needs House Credits alone; Prepayments Cashback only where a voucher sells", () => {
  const on = { ...allOn, credit_cashback_bps: 200, prepay_cashback_bps: 500 };
  const s = moneyState(on, can, null);
  assertEquals([s.credit_cashback_bps, s.prepay_cashback_bps], [200, 500]);
  // No Stripe: the credit part still earns, the voucher price cannot (nothing sells).
  const noCards = moneyState(on, cannot, null);
  assertEquals([noCards.credit_cashback_bps, noCards.prepay_cashback_bps], [200, 0]);
  // Prepayments Off: no voucher sells, so no voucher cashback.
  assertEquals(moneyState({ ...on, prepayments: false }, can, null).prepay_cashback_bps, 0);
  // House Credits Off: neither earns (new credit needs House Credits).
  const noHc = moneyState({ ...on, house_credits: false }, can, null);
  assertEquals([noHc.credit_cashback_bps, noHc.prepay_cashback_bps], [0, 0]);
  // Off reads 0.
  assertEquals(moneyState(allOn, can, null).credit_cashback_bps, 0);
});
