// Money (MESITA-4766, MESITA-5072): the cashback record setPlaceCashback sends
// is exactly readCashback's fields, with both VIP rates 0 and Returning 10%
// only where Small's bonus is +20% (the server refuses anything else).
import { describe, expect, it } from "vitest";
import { CASHBACK_DEFAULTS, readCashback, returningPicks, saveableCashback } from "./cashback";

describe("readCashback", () => {
  it("drops story_reward_cents", () => {
    const out = readCashback({ welcome_bonus_bps: 6000, returning_bps: 0, story_reward_cents: 4000 } as never);
    expect(out).toEqual({ ...CASHBACK_DEFAULTS, welcome_bonus_bps: 6000, returning_bps: 0 });
    expect("story_reward_cents" in out).toBe(false);
  });
});

describe("saveableCashback", () => {
  it("sends both VIP rates as 0", () => {
    const out = saveableCashback({ ...CASHBACK_DEFAULTS, welcome_bps: 2000, returning_vip_bps: 2000, welcome_vip_bps: 1000 });
    // Welcome is a voucher (MESITA-5124): its cashback line is always sent 0.
    expect([out.welcome_bps, out.welcome_vip_bps, out.returning_vip_bps]).toEqual([0, 0, 0]);
  });

  it("keeps Returning 10% only while Small is +20%", () => {
    expect(returningPicks(2000)).toEqual([0, 500, 1000]);
    expect(returningPicks(1000)).toEqual([0, 500]);
    expect(saveableCashback({ ...CASHBACK_DEFAULTS, returning_bps: 1000, small_bonus_bps: 2000 }).returning_bps).toBe(1000);
    expect(saveableCashback({ ...CASHBACK_DEFAULTS, returning_bps: 1000, small_bonus_bps: 1000 }).returning_bps).toBe(500);
    expect(saveableCashback({ ...CASHBACK_DEFAULTS, returning_bps: 0, small_bonus_bps: 1000 }).returning_bps).toBe(0);
  });
});
