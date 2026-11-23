// MESITA-4698: what a bill earns is guest money; pin the arithmetic the SQL
// trigger mirrors (pay_tab_grant_cashback) and the owner's allowed inputs.
// Two lines since MESITA-4709: Welcome, then Returning.
import { assertEquals } from "jsr:@std/assert@1";
import { CASHBACK_DEFAULTS, cashbackCents, cashbackLine, readCashbackInput, voucherBonusFrom } from "./cashback.ts";

Deno.test("cashback: Welcome wins the first bill, Returning every later one", () => {
  assertEquals(cashbackLine(true), "welcome");
  assertEquals(cashbackLine(false), "returning");
});

Deno.test("cashback: rate on the part, rounded down, capped", () => {
  // MX$500 at Returning 5% = MX$25.
  assertEquals(cashbackCents(CASHBACK_DEFAULTS, "returning", 50000), 2500);
  // MX$333.33 at 5% rounds down.
  assertEquals(cashbackCents(CASHBACK_DEFAULTS, "returning", 33333), 1666);
  // MX$5,000 at Welcome 10% = MX$500, capped at MX$200.
  // No ceiling (MESITA-4728): MX$5,000 at 10% is MX$500, not MX$200.
  assertEquals(cashbackCents(CASHBACK_DEFAULTS, "welcome", 500000), 50000);
  // Off earns nothing; nothing outside earns nothing.
  assertEquals(cashbackCents({ ...CASHBACK_DEFAULTS, returning_bps: 0 }, "returning", 50000), 0);
  assertEquals(cashbackCents(CASHBACK_DEFAULTS, "returning", 0), 0);
});

Deno.test("cashback: Welcome is Off, 10 or 20%; Returning Off, 5 or 10% (MESITA-4764)", () => {
  assertEquals(readCashbackInput({ welcome_bps: 2000, returning_bps: 1000, cap_cents: 20000 }).ok, true);
  assertEquals(readCashbackInput({ welcome_bps: 0, returning_bps: 0, cap_cents: 0 }).ok, true);
  assertEquals(readCashbackInput({ welcome_bps: 500, returning_bps: 500 }).ok, false);
  assertEquals(readCashbackInput({ welcome_bps: 1500, returning_bps: 500 }).ok, false);
  assertEquals(readCashbackInput({ welcome_bps: 1000, returning_bps: 2000 }).ok, false);
  assertEquals(readCashbackInput({ welcome_bps: 1000, returning_bps: 1500 }).ok, false);
  // An older console's cap is ignored, never stored (MESITA-4728).
  const old = readCashbackInput({ welcome_bps: 1000, returning_bps: 500, cap_cents: -1 });
  assertEquals(old.ok && "cap_cents" in old.rates, false);
  assertEquals(readCashbackInput({ welcome_bps: 1000, returning_bps: 500 }).ok, true, "no cap to send");
  // The retired VIP line's old field alone no longer passes for Returning.
  assertEquals(readCashbackInput({ welcome_bps: 1000, regular_bps: 500, cap_cents: 20000 }).ok, false);
});

Deno.test("voucher bonus: two picks per size; absent keeps the saved one (MESITA-4764)", () => {
  const base = { welcome_bps: 1000, returning_bps: 500 };
  const ok = readCashbackInput({ ...base, small_bonus_bps: 2000, medium_bonus_bps: 4000, big_bonus_bps: 6000 });
  assertEquals(ok.ok && [ok.rates.small_bonus_bps, ok.rates.medium_bonus_bps, ok.rates.big_bonus_bps], [2000, 4000, 6000]);
  assertEquals(readCashbackInput({ ...base, small_bonus_bps: 1000, medium_bonus_bps: 2000, big_bonus_bps: 4000 }).ok, true);
  for (const [f, v] of [["small_bonus_bps", 4000], ["medium_bonus_bps", 1000], ["big_bonus_bps", 3000], ["big_bonus_bps", 0], ["small_bonus_bps", "2000"]] as const) {
    assertEquals(readCashbackInput({ ...base, [f]: v }).ok, false, `${f}=${v}`);
  }
  const absent = readCashbackInput(base);
  assertEquals(absent.ok && "small_bonus_bps" in absent.rates, false);
  assertEquals(voucherBonusFrom({ small_bonus_bps: 2000, medium_bonus_bps: 2000, big_bonus_bps: 6000 }), { voucher_200: 2000, voucher_1000: 2000, voucher_5000: 6000 });
});
