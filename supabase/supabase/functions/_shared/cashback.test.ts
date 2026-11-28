// MESITA-4698: what a bill earns is guest money; pin the arithmetic the SQL
// trigger mirrors (pay_tab_grant_cashback) and the owner's allowed inputs.
// One line since MESITA-5124: every bill earns the one Cashback rate
// (returning_bps); Welcome is a voucher. A VIP earns the same.
import { assertEquals } from "jsr:@std/assert@1";
import { CASHBACK_CAP_CENTS, CASHBACK_DEFAULTS, cashbackCents, cashbackLine, maxCashbackBps, readCashbackInput, voucherBonusFrom } from "./cashback.ts";

Deno.test("cashback: one line — every bill is Returning; Welcome and the VIP lines earn nothing new (MESITA-5124)", () => {
  assertEquals(cashbackLine(), "returning");
  // A row still holding an old Welcome or VIP rate pays nothing on them.
  const rates = { ...CASHBACK_DEFAULTS, welcome_bps: 1000, returning_bps: 500, returning_vip_bps: 2000, welcome_vip_bps: 2000 };
  assertEquals(cashbackCents(rates, "returning", 10000), 500);
  assertEquals(cashbackCents(rates, "welcome", 10000), 0);
  assertEquals(cashbackCents(rates, "returning_vip", 10000), 0);
  assertEquals(cashbackCents(rates, "welcome_vip", 10000), 0);
  assertEquals(maxCashbackBps(rates), 500);
  assertEquals([CASHBACK_DEFAULTS.welcome_bps, CASHBACK_DEFAULTS.welcome_vip_bps, CASHBACK_DEFAULTS.returning_vip_bps], [0, 0, 0]);
});

Deno.test("cashback save: a Welcome rate an older console sends is ignored; every save writes Welcome 0 (MESITA-5124)", () => {
  for (const welcome_bps of [1000, 2000, 500, "x", undefined]) {
    const r = readCashbackInput({ welcome_bps, returning_bps: 500 });
    assertEquals(r.ok && r.rates.welcome_bps, 0, `welcome_bps=${welcome_bps}`);
  }
  assertEquals(readCashbackInput({ welcome_bps: 1000 }).ok, false, "the one rate is required");
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
  // No MX$200 ceiling (MESITA-4728): MX$5,000 at 10% is MX$500.
  assertEquals(cashbackCents({ ...CASHBACK_DEFAULTS, returning_bps: 1000 }, "returning", 500000), 50000);
  // Off earns nothing; nothing outside earns nothing.
  assertEquals(cashbackCents({ ...CASHBACK_DEFAULTS, returning_bps: 0 }, "returning", 50000), 0);
  assertEquals(cashbackCents(CASHBACK_DEFAULTS, "returning", 0), 0);
});

Deno.test("cashback: the one rate is Off, 5 or 10% (MESITA-4764, MESITA-5124)", () => {
  assertEquals(readCashbackInput({ returning_bps: 1000, small_bonus_bps: 2000, cap_cents: 20000 }).ok, true);
  assertEquals(readCashbackInput({ returning_bps: 0, cap_cents: 0 }).ok, true);
  assertEquals(readCashbackInput({ returning_bps: 2000 }).ok, false);
  assertEquals(readCashbackInput({ returning_bps: 1500 }).ok, false);
  // An older console's cap is ignored, never stored (MESITA-4728).
  const old = readCashbackInput({ returning_bps: 500, cap_cents: -1 });
  assertEquals(old.ok && "cap_cents" in old.rates, false);
  assertEquals(readCashbackInput({ returning_bps: 500 }).ok, true, "no cap to send");
  // The retired VIP line's old field alone no longer passes for the rate.
  assertEquals(readCashbackInput({ regular_bps: 500, cap_cents: 20000 }).ok, false);
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

Deno.test("voucher bonus: Welcome is +30% or +60%, the place's pick (MESITA-5124)", () => {
  const base = { returning_bps: 500 };
  for (const v of [3000, 6000]) {
    const r = readCashbackInput({ ...base, welcome_bonus_bps: v });
    assertEquals(r.ok && r.rates.welcome_bonus_bps, v);
  }
  for (const v of [0, 1000, 10000, "3000"]) assertEquals(readCashbackInput({ ...base, welcome_bonus_bps: v }).ok, false, `welcome_bonus_bps=${v}`);
  assertEquals(CASHBACK_DEFAULTS.welcome_bonus_bps, 3000);
  assertEquals(voucherBonusFrom({ welcome_bonus_bps: 6000 }), { voucher_welcome: 6000 });
});

// MESITA-5076: the column is gone; an older console's visit_mechanism is
// ignored so the save still lands (a write naming it would fail).
Deno.test("cashback save: a visit_mechanism an older console sends never reaches the write", () => {
  const r = readCashbackInput({ welcome_bps: 1000, returning_bps: 500, visit_mechanism: "cashback" });
  assertEquals(r.ok && "visit_mechanism" in r.rates, false);
});

Deno.test("cashback: one bill earns MX$1,000 at most (MESITA-4831)", () => {
  const rates = { ...CASHBACK_DEFAULTS, returning_bps: 1000 };
  assertEquals(cashbackCents(rates, "returning", 1_000_000), CASHBACK_CAP_CENTS);
  assertEquals(cashbackCents(rates, "returning", 1_000_010), CASHBACK_CAP_CENTS);
  assertEquals(cashbackCents(rates, "returning", 10_000_000), CASHBACK_CAP_CENTS);
});
