import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  PLACE_TAB_SECTIONS,
  isSectionSoon,
} from "./nav";

const here = dirname(fileURLToPath(import.meta.url));

describe("PLACE_TAB_SECTIONS", () => {
  it("unparks Promos and keeps Performance Soon", () => {
    const byId = Object.fromEntries(
      PLACE_TAB_SECTIONS.map((s) => [s.id, s]),
    );
    expect(byId.promos?.soon).toBe(false);
    expect(byId.performance?.soon).toBe(true);
    expect(isSectionSoon("promos")).toBe(false);
    expect(isSectionSoon("performance")).toBe(true);
  });
});

describe("PromosSection visit-only", () => {
  it("is two boxes — Partnership and Visit Promotions", () => {
    const src = readFileSync(
      join(here, "sections/PromosSection.tsx"),
      "utf8",
    );
    expect(src).toMatch(/title="Mesita Partnership"/);
    expect(src).toMatch(/title="Visit Promotions"/);
    expect((src.match(/<SectionCard/g) ?? []).length).toBe(2);
    expect(src).toMatch(/pickerStrategies/);
    expect(src).toMatch(/giveWord/);
    expect(src).toMatch(/placementWord/);
    expect(src).toMatch(/orders and prepaid stay off/);
    expect(src).not.toMatch(/matrix\.orders/);
    expect(src).not.toMatch(/title="FAQs"/);
    expect(src).not.toMatch(/title="Calculator"/);
    expect(src).not.toMatch(/title="Discount Cap"/);
    expect(src).not.toMatch(/FaqsBox/);
    expect(src).not.toMatch(/VisitDistributionCalculator/);
    expect(src).not.toMatch(/DiscountCapPicker/);
    expect(src).not.toContain("[capError, setCapError]");
    // Dominant is not a picker option.
    expect(src).toMatch(/s\.id !== "dominant"/);
    expect(src).not.toMatch(/current === "dominant"/);
    expect(src).toMatch(/RUNG_WORDS/);
    expect(src).not.toMatch(/RewardsMatrix/);
    expect(src).not.toMatch(/See full rates/);
    expect(src).not.toMatch(/giveLevel/);
    const card = src.slice(
      src.indexOf("function StrategyCard"),
      src.indexOf("function ArtBand"),
    );
    expect(card).toMatch(/Give/);
    expect(card).toMatch(/Placement/);
    expect(card).not.toMatch(/%/);
    expect(card).not.toMatch(/~/);
  });
});
