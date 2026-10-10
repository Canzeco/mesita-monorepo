import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tabsForAccess } from "@/lib/place-tabs";
import { ADMIN_PLACE_ACCESS, adminPlaceTabs } from "./access";
import { stripPills } from "./PlaceTabStrip";

// Every pill the strip draws has a page beneath this folder, and every view
// the layout publishes gets a pill — so a door is never drawn to a 404 and a
// published view is never unreachable.
describe("Single Place strip", () => {
  const tabs = adminPlaceTabs();

  it("is the First Stage cut: Profile and Admin, nothing else (MESITA-2088)", () => {
    // The matrix still grants a super-admin owner every view; the cut is
    // admin's, so this proves it actually removes something.
    expect(tabsForAccess(ADMIN_PLACE_ACCESS).length).toBeGreaterThan(2);
    expect(tabs).toEqual(["profile", "admin"]);
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

  // setup/, pay/ and activity/ still stand, unlinked: the generated
  // products-lane test reads their source until MESITA-2089 removes the
  // generator, and the follow-up deletes them with it.
  it("leaves no route folder behind for a cut view", () => {
    for (const seg of [
      "visits",
      "orders",
      "reservations",
      "rewards",
      "credits",
      "capital",
    ]) {
      expect(existsSync(join(__dirname, seg)), seg).toBe(false);
    }
  });
});
