// MESITA-4698: what a bill earns is guest money; pin the arithmetic the SQL
// trigger mirrors (pay_tab_grant_cashback) and the owner's allowed inputs.
// Two lines since MESITA-5072: Welcome and Returning; a VIP earns the same.
import { assertEquals } from "jsr:@std/assert@1";
import { CASHBACK_CAP_CENTS, CASHBACK_DEFAULTS, cashbackCents, cashbackLine, maxCashbackBps, readCashbackInput, voucherBonusFrom } from "./cashback.ts";

Deno.test("cashback: two lines — the first bill is Welcome, then Returning; VIP lines earn nothing new (MESITA-5072)", () => {
  assertEquals(cashbackLine(true), "welcome");
  assertEquals(cashbackLine(false), "returning");
  // A row still holding an old VIP rate pays nothing on the retired lines.
  const rates = { ...CASHBACK_DEFAULTS, welcome_bps: 1000, returning_bps: 500, returning_vip_bps: 2000, welcome_vip_bps: 2000 };
  assertEquals(cashbackCents(rates, "returning", 10000), 500);
  assertEquals(cashbackCents(rates, "welcome", 10000), 1000);
  assertEquals(cashbackCents(rates, "returning_vip", 10000), 0);
  assertEquals(cashbackCents(rates, "welcome_vip", 10000), 0);
  assertEquals(maxCashbackBps(rates), 1000);
  assertEquals([CASHBACK_DEFAULTS.welcome_vip_bps, CASHBACK_DEFAULTS.returning_vip_bps], [0, 0]);
});

Deno.test("cashback save: a non-zero VIP rate is refused; every save writes both VIP rates 0 (MESITA-5072)", () => {
  const base = { welcome_bps: 1000, returning_bps: 500 };
  assertEquals(readCashbackInput({ ...base, welcome_vip_bps: 2000 }).ok, false);
  assertEquals(readCashbackInput({ ...base, returning_vip_bps: 1000 }).ok, false);
  assertEquals(readCashbackInput({ ...base, returning_vip_bps: "0" }).ok, false);
  const zero = readCashbackInput({ ...base, welcome_vip_bps: 0, returning_vip_bps: 0 });
  assertEquals(zero.ok && [zero.rates.welcome_vip_bps, zero.rates.returning_vip_bps], [0, 0]);
  const absent = readCashbackInput(base);
  assertEquals(absent.ok && [absent.rates.welcome_vip_bps, absent.rates.returning_vip_bps], [0, 0]);
  const story = readCashbackInput({ ...base, story_reward_cents: 2000 });
  assertEquals(story.ok && "story_reward_cents" in story.rates, false);
});

Deno.test("cashback save: Returning 10% only where Small's bonus is +20% (MESITA-5072)", () => {
  const top = { welcome_bps: 1000, returning_bps: 1000 };
  assertEquals(readCashbackInput({ ...top, small_bonus_bps: 2000 }).ok, true);
  assertEquals(readCashbackInput({ ...top, small_bonus_bps: 1000 }).ok, false);
  assertEquals(readCashbackInput(top, { small_bonus_bps: 2000 }).ok, true, "the saved Small");
  assertEquals(readCashbackInput(top, { small_bonus_bps: 1000 }).ok, false);
  assertEquals(readCashbackInput({ ...top, small_bonus_bps: 1000 }, { small_bonus_bps: 2000 }).ok, false, "this save's Small wins");
  assertEquals(readCashbackInput(top).ok, false, "an unknown Small never allows 10%");
  assertEquals(readCashbackInput({ welcome_bps: 1000, returning_bps: 500 }, { small_bonus_bps: 1000 }).ok, true);
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
  assertEquals(readCashbackInput({ welcome_bps: 2000, returning_bps: 1000, small_bonus_bps: 2000, cap_cents: 20000 }).ok, true);
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
  assertEquals(readCashbackInput({ ...base, small_bonus_bps: 1000, medium_bonus_bps: 2000, big_bonus_bps: 3000 }).ok, true);
  for (const [f, v] of [["small_bonus_bps", 4000], ["medium_bonus_bps", 1000], ["big_bonus_bps", 4000], ["big_bonus_bps", 0], ["small_bonus_bps", "2000"]] as const) {
    assertEquals(readCashbackInput({ ...base, [f]: v }).ok, false, `${f}=${v}`);
  }
  const absent = readCashbackInput(base);
  assertEquals(absent.ok && "small_bonus_bps" in absent.rates, false);
  assertEquals(voucherBonusFrom({ small_bonus_bps: 2000, medium_bonus_bps: 2000, big_bonus_bps: 6000 }), { voucher_200: 2000, voucher_1000: 2000, voucher_5000: 6000 });
});

// MESITA-5076: the column is gone; an older console's visit_mechanism is
// ignored so the save still lands (a write naming it would fail).
Deno.test("cashback save: a visit_mechanism an older console sends never reaches the write", () => {
  const r = readCashbackInput({ welcome_bps: 1000, returning_bps: 500, visit_mechanism: "cashback" });
  assertEquals(r.ok && "visit_mechanism" in r.rates, false);
});

Deno.test("cashback: one bill earns MX$1,000 at most (MESITA-4831)", () => {
  const rates = { ...CASHBACK_DEFAULTS, welcome_bps: 1000 };
  assertEquals(cashbackCents(rates, "welcome", 1_000_000), CASHBACK_CAP_CENTS);
  assertEquals(cashbackCents(rates, "welcome", 1_000_010), CASHBACK_CAP_CENTS);
  assertEquals(cashbackCents(rates, "welcome", 10_000_000), CASHBACK_CAP_CENTS);
});
