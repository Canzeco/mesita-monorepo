import { describe, expect, it } from "vitest";
import { PROMOTION_SCORE_MAX, promotionScore } from "./promotion-score";

const NOTHING = {
  partner: false,
  visitRewardsLevel: 0,
  mesitaPay: false,
  yums: false,
  pickup: false,
  delivery: false,
};

describe("promotionScore (twin of _shared/promotion-score.ts)", () => {
  it("scores 0 with nothing offered and the max with everything", () => {
    expect(promotionScore(NOTHING)).toBe(0);
    expect(
      promotionScore({
        partner: true,
        visitRewardsLevel: 2,
        mesitaPay: true,
        yums: true,
        pickup: true,
        delivery: true,
      }),
    ).toBe(PROMOTION_SCORE_MAX);
  });

  it("partnership is the first step (+1 alone)", () => {
    expect(promotionScore({ ...NOTHING, partner: true })).toBe(1);
  });

  it("clamps Dominant (engine 3) to the operator 2 and garbage to 0", () => {
    expect(promotionScore({ ...NOTHING, visitRewardsLevel: 3 })).toBe(2);
    expect(promotionScore({ ...NOTHING, visitRewardsLevel: Number.NaN })).toBe(0);
    expect(promotionScore({ ...NOTHING, visitRewardsLevel: -4 })).toBe(0);
  });
});
