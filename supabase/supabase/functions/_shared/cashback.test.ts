// MESITA-4698: what a bill earns is guest money; pin the arithmetic the SQL
// trigger mirrors (pay_tab_grant_cashback) and the owner's allowed inputs.
import { assertEquals } from "jsr:@std/assert@1";
import { CASHBACK_DEFAULTS, cashbackCents, cashbackLine, readCashbackInput } from "./cashback.ts";

Deno.test("cashback: Welcome wins the first bill, then the Class decides", () => {
  assertEquals(cashbackLine({ firstBill: true, guestClass: "vip" }), "welcome");
  assertEquals(cashbackLine({ firstBill: false, guestClass: "vip" }), "vip");
  assertEquals(cashbackLine({ firstBill: false, guestClass: "regular" }), "regular");
  assertEquals(cashbackLine({ firstBill: false, guestClass: null }), "regular");
});

Deno.test("cashback: rate on the part, rounded down, capped", () => {
  // MX$500 at Regular 5% = MX$25.
  assertEquals(cashbackCents(CASHBACK_DEFAULTS, "regular", 50000), 2500);
  // MX$333.33 at 5% rounds down.
  assertEquals(cashbackCents(CASHBACK_DEFAULTS, "regular", 33333), 1666);
  // MX$5,000 at Welcome 10% = MX$500, capped at MX$200.
  assertEquals(cashbackCents(CASHBACK_DEFAULTS, "welcome", 500000), 20000);
  // Off earns nothing; nothing outside earns nothing.
  assertEquals(cashbackCents({ ...CASHBACK_DEFAULTS, vip_bps: 0 }, "vip", 50000), 0);
  assertEquals(cashbackCents(CASHBACK_DEFAULTS, "vip", 0), 0);
  assertEquals(cashbackCents({ ...CASHBACK_DEFAULTS, cap_cents: 0 }, "vip", 50000), 0);
});

Deno.test("cashback: the owner picks only Off, 5, 10, 15 or 20%", () => {
  assertEquals(readCashbackInput({ welcome_bps: 1000, regular_bps: 500, vip_bps: 2000, cap_cents: 20000 }).ok, true);
  assertEquals(readCashbackInput({ welcome_bps: 0, regular_bps: 0, vip_bps: 0, cap_cents: 0 }).ok, true);
  assertEquals(readCashbackInput({ welcome_bps: 700, regular_bps: 500, vip_bps: 1000, cap_cents: 20000 }).ok, false);
  assertEquals(readCashbackInput({ welcome_bps: 2500, regular_bps: 500, vip_bps: 1000, cap_cents: 20000 }).ok, false);
  assertEquals(readCashbackInput({ welcome_bps: 1000, regular_bps: 500, vip_bps: 1000, cap_cents: -1 }).ok, false);
  assertEquals(readCashbackInput({ welcome_bps: 1000, regular_bps: 500, vip_bps: 1000, cap_cents: 1.5 }).ok, false);
  assertEquals(readCashbackInput({ welcome_bps: 1000, regular_bps: 500, vip_bps: 1000 }).ok, false);
});
