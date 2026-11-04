import { describe, expect, it } from "vitest";
import { billAfterRewards, type PlaceReward } from "@/lib/api/rewards";

const reward = (percent: number, over: Partial<PlaceReward> = {}): PlaceReward => ({
  kind: "welcome_visit",
  percent,
  cap_cents: null,
  eligible: true,
  reason: null,
  ...over,
});

// The same sum as place_visit_create (20261104060000_rewards_add_up.sql), so what
// the guest reads before the visit is what staff's page says after it.
describe("billAfterRewards", () => {
  it("adds up the rewards this guest has", () => {
    expect(billAfterRewards(20000, [reward(20), reward(20), reward(20, { eligible: false })])).toEqual({ offCents: 8000, payCents: 12000 });
  });
  it("stops at the Cap", () => {
    expect(billAfterRewards(100000, [reward(30, { cap_cents: 20000 })])).toEqual({ offCents: 20000, payCents: 80000 });
  });
  it("rounds half a cent up", () => {
    expect(billAfterRewards(50, [reward(1)])).toEqual({ offCents: 1, payCents: 49 });
  });
  it("never takes off more than the bill", () => {
    expect(billAfterRewards(1000, [reward(70), reward(70)])).toEqual({ offCents: 1000, payCents: 0 });
  });
});
