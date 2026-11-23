// Money (MESITA-4766): the cashback record setPlaceCashback sends is exactly
// readCashback's fields, so returning_vip_bps always goes to the server and a
// stale story_reward_cents never does (the server refuses unknown fields).
import { describe, expect, it } from "vitest";
import { CASHBACK_DEFAULTS, readCashback } from "./cashback";

describe("readCashback", () => {
  it("keeps returning_vip_bps and drops story_reward_cents", () => {
    const out = readCashback({ welcome_bps: 2000, returning_bps: 0, returning_vip_bps: 2000, story_reward_cents: 4000 } as never);
    expect(out).toEqual({ ...CASHBACK_DEFAULTS, welcome_bps: 2000, returning_bps: 0, returning_vip_bps: 2000 });
    expect("story_reward_cents" in out).toBe(false);
  });

  it("fills a missing returning_vip_bps from the defaults (an older server)", () => {
    expect(readCashback({ welcome_bps: 0, returning_bps: 500 }).returning_vip_bps).toBe(CASHBACK_DEFAULTS.returning_vip_bps);
  });
});
