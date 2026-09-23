import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import type { RewardQuote } from "@/lib/api/tickets";

import { BonusList, ClassLadder } from "./reward-matrix";

const QUOTE: RewardQuote = {
  strategy: "aggressive",
  classKey: "diamond",
  additive: true,
  isFirstVisit: false,
  base: 50,
  bonuses: { welcome: 0, story: 10, google: 15, mesita: 5 },
  storyEligible: true,
  cap: 200,
  breakdown: {
    automatic: 20,
    classes: { bronze: 0, diamond: 30 },
    cls: "diamond",
  },
};

/** The ladder's words. None may render on the rate sheet (MESITA-2044). */
const RETIRED = /\b(Bronze|Silver|Gold|VIP|class|tier|rank|rung|level|climb)\b|You(?:&#x27;|')re Diamond/i;

const rows = (html: string) =>
  [...html.matchAll(/type-body flex[^>]*>([^<]+)/g)].map((m) => m[1]);

describe("the Rewards rate sheet names exactly two identity rows", () => {
  it("prints Base, then the Diamond List as an adder — nothing else", () => {
    const html = renderToStaticMarkup(
      <ClassLadder quote={QUOTE} classKey="diamond" />,
    );
    expect(rows(html)).toEqual(["Base", "Diamond List"]);
    expect(html).toContain("Every guest, every visit");
    expect(html).toContain("Invitation only");
    expect(html).toContain("20%");
    expect(html).toContain("+30%");
    // An adder, never a standing total.
    expect(html).not.toContain("50%");
  });

  it("marks the guest's own row: the list when on it, Base when not", () => {
    const on = renderToStaticMarkup(
      <ClassLadder quote={QUOTE} classKey="diamond" />,
    );
    const off = renderToStaticMarkup(
      <ClassLadder quote={QUOTE} classKey="bronze" />,
    );
    // "You" sits inside the marked row's label, after the label text.
    expect(on.indexOf("You")).toBeGreaterThan(on.indexOf("Diamond List"));
    expect(off.indexOf("You")).toBeLessThan(off.indexOf("Diamond List"));
    expect(off.indexOf("You")).toBeGreaterThan(off.indexOf("Base"));
  });

  it("a legacy ladder reads Base off `standard` and the list's adder off `aura`", () => {
    const legacy: RewardQuote = {
      ...QUOTE,
      additive: false,
      breakdown: undefined,
      ladder: { standard: 15, influencer: 20, premium: 15, aura: 35 },
    };
    const html = renderToStaticMarkup(
      <ClassLadder quote={legacy} classKey="bronze" />,
    );
    expect(rows(html)).toEqual(["Base", "Diamond List"]);
    expect(html).toContain("15%");
    expect(html).toContain("+20%");
  });

  it("FAILS if a retired ladder word renders, for either guest", () => {
    for (const classKey of ["bronze", "diamond"]) {
      const html =
        renderToStaticMarkup(<ClassLadder quote={QUOTE} classKey={classKey} />) +
        renderToStaticMarkup(<BonusList quote={QUOTE} />);
      // Text only — `class="…"` attributes are markup, not copy.
      expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(RETIRED);
    }
  });

  // A Free/Premium pair sat between the class ladder and the bonuses, and its
  // Premium row was the sheet's one button (MESITA-1620). MESITA-1705 removed
  // the plan from pricing, so the row could only ever have shown +0%; PlanRow
  // is gone with it. Guarded structurally so it cannot come back unnoticed.
  it("names no plan rung and offers no button — the sheet is read-only", () => {
    const html =
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
