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
  it("labels Partner on the frozen /promos id; Performance stays Soon", () => {
    expect(PLACE_TAB_SECTIONS.map((s) => s.label)).toEqual([
      "Profile",
      "Partner",
      "Performance",
      "Settings",
      "Admin",
    ]);
    const byId = Object.fromEntries(
      PLACE_TAB_SECTIONS.map((s) => [s.id, s]),
    );
    expect(byId.promos?.label).toBe("Partner");
    expect(byId.promos?.soon).toBe(false);
    expect(byId.performance?.soon).toBe(true);
    expect(isSectionSoon("promos")).toBe(false);
    expect(isSectionSoon("performance")).toBe(true);
    // Profile = the place; Partner = membership/promos. Distinct glyphs.
    expect(byId.place?.Icon.displayName).toBe("Store");
    expect(byId.promos?.Icon.displayName).toBe("Percent");
    expect(byId.admin?.Icon.displayName).toBe("User");
  });
});

describe("PromosSection visit-only", () => {
  it("is three boxes — Offerings (the bar), Partnership, Visit Rewards", () => {
    const src = readFileSync(
      join(here, "sections/PromosSection.tsx"),
      "utf8",
    );
    expect(src).toMatch(/title="Partnership"/);
    // The Tutorial box is DELETED (Pato, 2026-08-29): the admin console does
    // not teach its own operator. Never reintroduce it on this tab.
    expect(src).not.toMatch(/title="Tutorial"/);
    expect(src).not.toMatch(/TutorialBox/);
    // The bar is "Offerings" and the tiles are "Visit Rewards" (Pato,
    // 2026-08-30): "promo" and "membership" are BANNED in rendered copy.
    expect(src).toMatch(/title="Offerings"/);
    expect(src).not.toMatch(/title="Promos"/);
    expect(src).not.toMatch(/Partnership Membership/);
    expect(src).toMatch(/title="Visit Rewards"/);
    expect((src.match(/<SectionCard/g) ?? []).length).toBe(3);
    // The bar sums Partnership + Visit Rewards + the four rail toggles, with
    // Mesita Capital as a locked Soon row; the score twin caps it.
    expect(src).toMatch(/OfferingsBar|PromosBar/);
    expect(src).toMatch(/promotionScore\(/);
    expect(src).toMatch(/PROMOTION_SCORE_MAX/);
    expect(src).toMatch(/RailToggle/);
    expect(src).toMatch(/setPlaceRails/);
    expect(src).toMatch(/Mesita Capital/);
    expect(src).toMatch(/never buys rank/);
    expect(src).not.toMatch(/title="Mesita Partnership"/);
    expect(src).not.toMatch(/title="Visit Promotions"/);
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
    expect(src).toMatch(/Details/);
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
