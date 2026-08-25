import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { RewardQuote } from "@/lib/api/tickets";

import { BaseRow, BonusList, ClassLadder, PlanRow } from "./reward-matrix";

const QUOTE: RewardQuote = {
  strategy: "aggressive",
  classKey: "diamond",
  additive: true,
  isFirstVisit: false,
  base: 70,
  bonuses: { welcome: 0, story: 10, google: 15, mesita: 5 },
  storyEligible: true,
  cap: 200,
  breakdown: {
    automatic: 20,
    classes: { bronze: 0, silver: 10, gold: 20, diamond: 30 },
    cls: "diamond",
    plan: "premium",
    planUplift: 20,
  },
};

describe("the Rewards rate sheet names every priced rung", () => {
  it("prints Base as the bronze·free floor", () => {
    const html = renderToStaticMarkup(<BaseRow quote={QUOTE} />);
    expect(html).toContain("Base");
    expect(html).toContain("20%");
  });

  it("prints all four metals as adders, not standing totals", () => {
    const html = renderToStaticMarkup(
      <ClassLadder quote={QUOTE} classKey="diamond" />,
    );
    expect(html).toContain("Bronze");
    expect(html).toContain("Silver");
    expect(html).toContain("Gold");
    expect(html).toContain("Diamond");
    expect(html).toContain("+30%");
    expect(html).not.toContain("50%");
  });

  it("prints Free and Premium, using planUplift not ladder.premium", () => {
    const html = renderToStaticMarkup(
      <PlanRow quote={{ ...QUOTE, ladder: { premium: 40 } }} plan="premium" />,
    );
    expect(html).toContain("Free");
    expect(html).toContain("Premium");
    expect(html).toContain("+20%");
    expect(html).not.toContain("40%");
  });

  it("lists Welcome then Instagram Story, Google Review, Mesita Review", () => {
    const html = renderToStaticMarkup(<BonusList quote={QUOTE} />);
    const welcome = html.indexOf("Welcome");
    const story = html.indexOf("Instagram Story");
    const google = html.indexOf("Google Review");
    const mesita = html.indexOf("Mesita Review");
    expect(welcome).toBeGreaterThan(-1);
    expect(story).toBeGreaterThan(welcome);
    expect(google).toBeGreaterThan(story);
    expect(mesita).toBeGreaterThan(google);
  });
});
