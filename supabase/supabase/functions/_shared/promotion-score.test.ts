import { assertEquals } from "jsr:@std/assert@1";
import { PROMOTION_SCORE_MAX, promotionScore } from "./promotion-score.ts";

const NOTHING = {
  partner: false,
  visitRewardsLevel: 0,
  mesitaPay: false,
  credits: false,
  pickup: false,
  delivery: false,
};

Deno.test("promotionScore: nothing offered scores 0", () => {
  assertEquals(promotionScore(NOTHING), 0);
});

Deno.test("promotionScore: everything offered scores the max", () => {
  assertEquals(
    promotionScore({
      partner: true,
      visitRewardsLevel: 2,
      mesitaPay: true,
      credits: true,
      pickup: true,
      delivery: true,
    }),
    PROMOTION_SCORE_MAX,
  );
});

Deno.test("promotionScore: partnership is the first step (+1 alone)", () => {
  assertEquals(promotionScore({ ...NOTHING, partner: true }), 1);
});

Deno.test("promotionScore: Dominant (engine 3) clamps to the operator 2", () => {
  assertEquals(
    promotionScore({ ...NOTHING, partner: true, visitRewardsLevel: 3 }),
    3,
  );
});

Deno.test("promotionScore: garbage levels clamp to 0", () => {
  assertEquals(promotionScore({ ...NOTHING, visitRewardsLevel: Number.NaN }), 0);
  assertEquals(promotionScore({ ...NOTHING, visitRewardsLevel: -4 }), 0);
});
