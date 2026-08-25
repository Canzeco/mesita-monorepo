import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { HelpRungList } from "@/components/consumer/me/HelpModal";

const SRC = readFileSync(
  join(__dirname, "../../components/consumer/me/HelpModal.tsx"),
  "utf8",
);

describe("Help names every priced rung and quotes no static percent", () => {
  it("lists Base, metals, Free/Premium, Welcome, and the three sharing actions", () => {
    const html = renderToStaticMarkup(
      <HelpRungList classKey="diamond" plan="premium" />,
    );
    for (const label of [
      "Base",
      "Bronze",
      "Silver",
      "Gold",
      "Diamond",
      "Free",
      "Premium",
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

  it("does not import the education ladder that used to print fake rates", () => {
    expect(SRC).not.toContain("reward-segments");
    expect(SRC).not.toContain("REWARD_SEGMENTS");
    expect(SRC).not.toContain("PEAK_STRATEGY");
  });
});
