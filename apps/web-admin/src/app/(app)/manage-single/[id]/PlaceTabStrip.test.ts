import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FIRST_STAGE_TABS } from "./access";
import { stripPills } from "./PlaceTabStrip";

// Every pill the strip draws has a page beneath this folder, and every view
// the layout publishes gets a pill — so a door is never drawn to a 404 and a
// published view is never unreachable.
describe("Single Place strip", () => {
  const tabs = FIRST_STAGE_TABS;

  it("is Profile, Reviews, Preview, Admin, and Boost (MESITA-2789)", () => {
    expect(tabs).toEqual(["profile", "reviews", "preview", "admin", "boost"]);
  });

  it("draws one pill per view, each with a page.tsx", () => {
    const pills = stripPills("p-1", tabs);
    expect(pills.map((p) => p.key)).toEqual(tabs);
    for (const pill of pills) {
      expect(pill.href.startsWith("/manage-single/p-1/"), pill.href).toBe(true);
      const seg = pill.href.split("/")[3];
      expect(existsSync(join(__dirname, seg, "page.tsx")), `${seg}/page.tsx`).toBe(true);
    }
  });
});
