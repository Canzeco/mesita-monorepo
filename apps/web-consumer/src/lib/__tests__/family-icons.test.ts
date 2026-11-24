import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FAMILY_MARK_KEYS, familyMarkSrc } from "@/lib/family-icons";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";

// The guest's family marks are Fluent Flat files (MESITA-4782). A family
// added without its file would render a broken image on Home and Search.
describe("family marks (MESITA-4782)", () => {
  it("every guest family and special row has its own file on disk", () => {
    const keys = new Set<string>(FAMILY_MARK_KEYS);
    for (const f of FILTERABLE_PLACE_FAMILIES) expect(keys.has(f.key), f.key).toBe(true);
    for (const k of FAMILY_MARK_KEYS) {
      expect(existsSync(join(process.cwd(), "public", familyMarkSrc(k))), k).toBe(true);
    }
  });

  it("Search's nearby is Home's near; an unknown key wears Restaurants' plate", () => {
    expect(familyMarkSrc("nearby")).toBe("/families/near.svg");
    expect(familyMarkSrc("not_a_family")).toBe("/families/restaurants.svg");
  });
});
