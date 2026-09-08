import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { RewardQuote } from "@/lib/api/tickets";

import { BaseRow, BonusList, ClassLadder } from "./reward-matrix";

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
  },
};

describe("the Rewards rate sheet names every priced rung", () => {
  it("prints Base as the bronze floor", () => {
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

  // A Free/Premium pair sat between the class ladder and the bonuses, and its
  // Premium row was the sheet's one button (MESITA-1620). MESITA-1705 removed
  // the plan from pricing, so the row could only ever have shown +0%; PlanRow
  // is gone with it. Guarded structurally so it cannot come back unnoticed.
  it("names no plan rung and offers no button — the sheet is read-only", () => {
    const html =
      renderToStaticMarkup(<BaseRow quote={QUOTE} />) +
      renderToStaticMarkup(<ClassLadder quote={QUOTE} classKey="diamond" />) +
      renderToStaticMarkup(<BonusList quote={QUOTE} />);
    expect(html).not.toContain("Premium");
    expect(html).not.toContain("<button");
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
