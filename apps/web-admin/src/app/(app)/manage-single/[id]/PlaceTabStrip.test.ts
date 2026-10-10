import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tabsForAccess } from "@/lib/place-tabs";
import { ADMIN_PLACE_ACCESS } from "./access";
import { stripPills } from "./PlaceTabStrip";

// Every pill the strip draws has a page beneath this folder, and every view
// the matrix grants the operator gets a pill — so a door is never drawn to a
// 404 and a granted view is never unreachable.
describe("Single Place strip", () => {
  const tabs = tabsForAccess(ADMIN_PLACE_ACCESS);

  it("grants the operator every view, Admin included", () => {
    expect(tabs).toContain("admin");
    expect(tabs).toContain("profile");
    expect(tabs.length).toBeGreaterThan(5);
  });

  it("draws one pill per granted view plus the two pages, each with a page.tsx", () => {
    const pills = stripPills("p-1", tabs);
    expect(pills.map((p) => p.key)).toEqual(["profile", "setup", "activity", ...tabs.filter((t) => t !== "profile")]);
    for (const pill of pills) {
      expect(pill.href.startsWith("/manage-single/p-1/"), pill.href).toBe(true);
      const seg = pill.href.split("/")[3];
      expect(existsSync(join(__dirname, seg, "page.tsx")), `${seg}/page.tsx`).toBe(true);
    }
  });
});
