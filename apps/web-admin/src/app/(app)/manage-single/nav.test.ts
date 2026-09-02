import { describe, expect, it } from "vitest";

import {
  PLACE_TAB_SECTIONS,
  isPlaceSectionId,
  isSectionSoon,
} from "./nav";

// The tab law only. The old "PromosSection visit-only" describe grepped the
// SOURCE TEXT of PromosSection.tsx — it asserted `<SectionCard` appeared
// exactly three times plus ~25 other string literals, so any restructure
// broke it with no type error and no behavioural change. Deleted 2026-09-02
// ahead of the Controls rebuild; behaviour is asserted against rendered
// output in sections/controls/ instead. Never reintroduce a source-text grep
// here: it fails on formatting and passes on regressions.

describe("PLACE_TAB_SECTIONS", () => {
  it("is FOUR tabs — Profile · Controls · Activity · Admin", () => {
    expect(PLACE_TAB_SECTIONS.map((s) => s.label)).toEqual([
      "Profile",
      "Controls",
      "Activity",
      "Admin",
    ]);
    const byId = Object.fromEntries(
      PLACE_TAB_SECTIONS.map((s) => [s.id, s]),
    );
    // Labels move, URLs never follow: Controls keeps the frozen /promos id
    // (it absorbed Settings) and Activity keeps /performance.
    expect(byId.promos?.label).toBe("Controls");
    expect(byId.performance?.label).toBe("Activity");
    // Settings is not a tab any more — its surviving boxes live in the
    // Settings ZONE on Controls, and /settings redirects there via [...slug].
    expect(isPlaceSectionId("settings")).toBe(false);
    expect(byId.promos?.soon).toBe(false);
    expect(byId.performance?.soon).toBe(true);
    expect(isSectionSoon("promos")).toBe(false);
    expect(isSectionSoon("performance")).toBe(true);
    // Profile = the place; Controls = everything the place is set to.
    expect(byId.place?.Icon.displayName).toBe("Store");
    expect(byId.promos?.Icon.displayName).toBe("SlidersHorizontal");
    expect(byId.admin?.Icon.displayName).toBe("User");
  });
});
