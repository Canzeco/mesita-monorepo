// MESITA-3302 — moneyState, one outcome per case. It gates selling, so
// pinned under the money rule.

import { assertEquals } from "jsr:@std/assert@1";
import { type MoneySettings, moneyState } from "./money-state.ts";

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

Deno.test("a switch on with charges_enabled sells; the three later vouchers say why not", () => {
  const s = moneyState(allOn, can, null);
  assertEquals(s.sell, ["voucher_200", "voucher_1000", "voucher_welcome"]);
  assertEquals(s.unavailable, { voucher_5000: "not_yet", voucher_vip: "needs_card_payments", voucher_story: "needs_instagram" });
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

Deno.test("pay: both with a balance and an account, credit with a balance only, card with an account only, else none", () => {
  assertEquals(moneyState(off, can, { spendable_cents: 100 }).pay, "both");
  assertEquals(moneyState(off, cannot, { spendable_cents: 100 }).pay, "credit");
  assertEquals(moneyState(off, can, { spendable_cents: 0 }).pay, "card");
  assertEquals(moneyState(off, can, null).pay, "card");
  assertEquals(moneyState(off, null, null).pay, "none");
});
