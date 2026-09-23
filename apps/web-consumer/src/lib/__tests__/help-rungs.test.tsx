import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HelpRungList } from "@/components/consumer/me/HelpModal";

const SRC = readFileSync(
  join(__dirname, "../../components/consumer/me/HelpModal.tsx"),
  "utf8",
);

describe("Help names everything priced and quotes no static percent", () => {
  it("lists Base, Diamond, Welcome, and the three sharing actions", () => {
    const html = renderToStaticMarkup(<HelpRungList classKey="diamond" />);
    for (const label of [
      "Base",
      "Diamond",
      "Welcome",
      "Instagram Story",
      "Google Review",
      "Mesita Review",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("You");
    expect(html).not.toContain("%");
  });

  it("names no metal and no ladder (MESITA-2044)", () => {
    for (const classKey of ["bronze", "diamond"]) {
      // Text only — `class="…"` attributes are markup, not copy.
      const html = renderToStaticMarkup(
        <HelpRungList classKey={classKey} />,
      ).replace(/<[^>]+>/g, " ");
      expect(html).not.toMatch(/\b(Bronze|Silver|Gold|VIP|rung|class|tier)\b/i);
      expect(html).not.toMatch(/You(&#x27;|')re Diamond/);
    }
  });

  it("the You marker follows Diamond: Base off it, Diamond on it", () => {
    const off = renderToStaticMarkup(<HelpRungList classKey="bronze" />);
    const on = renderToStaticMarkup(<HelpRungList classKey="diamond" />);
    const you = (html: string) => html.indexOf(">You<");
    expect(you(off)).toBeLessThan(off.indexOf("Diamond"));
    expect(you(on)).toBeGreaterThan(on.indexOf("Diamond"));
  });

  it("says the discount line exactly, and only in Diamond's words", () => {
    expect(SRC).toContain("DIAMOND_HELP_LINE");
    expect(SRC).not.toMatch(/Elevated classes|every class above/);
  });

  it("names NO plan rung — the plan stopped pricing anything (MESITA-1705)", () => {
    // Free / Premium sat between the metals and Welcome. Listing them here
    // would tell the guest a subscription changes their rate, which is false.
    const html = renderToStaticMarkup(<HelpRungList classKey="bronze" />);
    expect(html).not.toContain("Premium");
    expect(html).not.toContain("No subscription");
  });

  it("does not import the education ladder that used to print fake rates", () => {
    expect(SRC).not.toContain("reward-segments");
    expect(SRC).not.toContain("REWARD_SEGMENTS");
    expect(SRC).not.toContain("PEAK_STRATEGY");
  });
});
