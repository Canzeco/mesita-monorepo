import { describe, expect, it } from "vitest";
import {
  amountDue,
  creditsForPrepayment,
  rewardsForVisit,
  tipFor,
  type RewardRule,
} from "./rewards";

const rules: RewardRule[] = [
  { id: "google-review", name: "Google Review Reward", requirement: "", enabled: true, percent: 5, mode: "discount" },
  { id: "instagram-story", name: "Instagram Story Reward", requirement: "", enabled: true, percent: 15, mode: "discount" },
  { id: "vip-class", name: "VIP Class Reward", requirement: "", enabled: true, percent: 10, mode: "cashback" },
  { id: "loyalty", name: "Loyalty Reward", requirement: "", enabled: true, percent: 10, mode: "cashback" },
  { id: "welcome", name: "Welcome Reward", requirement: "", enabled: false, percent: 10, mode: "discount" },
];

describe("rewardsForVisit", () => {
  it("applies at most two rewards, the two worth the most when the guest picks none", () => {
    const r = rewardsForVisit(1000, ["google-review", "instagram-story", "vip-class"], rules, { cap: 10_000 });
    expect(r.applied.map((a) => a.id)).toEqual(["instagram-story", "vip-class"]);
    expect(r.discount).toBe(150);
    expect(r.cashback).toBe(100);
  });

  it("respects the guest's own pick", () => {
    const r = rewardsForVisit(1000, ["google-review", "instagram-story", "vip-class"], rules, {
      cap: 10_000,
      chosen: ["google-review", "vip-class"],
    });
    expect(r.applied.map((a) => a.id)).toEqual(["google-review", "vip-class"]);
    expect(r.total).toBe(150);
  });

  it("never gives more than the cap across both rewards", () => {
    const r = rewardsForVisit(2000, ["instagram-story", "vip-class"], rules, { cap: 200 });
    expect(r.total).toBe(200);
    expect(r.applied[0]).toMatchObject({ id: "instagram-story", amount: 200, capped: true });
    expect(r.applied[1]).toMatchObject({ id: "vip-class", amount: 0, capped: true });
  });

  it("ignores disabled rewards, unknown picks and an empty bill", () => {
    expect(rewardsForVisit(1000, ["welcome"], rules).total).toBe(0);
    expect(rewardsForVisit(1000, ["instagram-story"], rules, { chosen: ["welcome"] }).total).toBe(0);
    expect(rewardsForVisit(0, ["instagram-story"], rules).total).toBe(0);
  });
});

describe("tip and amount due", () => {
  it("takes the tip on the bill before the discount", () => {
    const rewards = rewardsForVisit(1000, ["instagram-story"], rules);
    const tip = tipFor(1000, 10);
    expect(tip).toBe(100);
    expect(amountDue(1000, rewards, tip)).toBe(950);
  });

  it("does not take cashback off today's bill", () => {
    const rewards = rewardsForVisit(1000, ["vip-class"], rules);
    expect(amountDue(1000, rewards, 0)).toBe(1000);
    expect(rewards.cashback).toBe(100);
  });
});

describe("creditsForPrepayment", () => {
  it("adds the 10% bonus", () => {
    expect(creditsForPrepayment(1000)).toBe(1100);
    expect(creditsForPrepayment(0)).toBe(0);
  });
});
