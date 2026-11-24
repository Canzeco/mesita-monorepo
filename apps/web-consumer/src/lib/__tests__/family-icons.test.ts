import { describe, expect, it } from "vitest";
import {
  FAMILY_MARKS,
  FALLBACK_FAMILY_MARK,
  familyMark,
} from "@/lib/family-icons";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";

// The guest's family marks are coloured icons, never emoji (MESITA-4782).
// A family without its own mark would fall back silently to a grey sparkle.
describe("family marks (MESITA-4782)", () => {
  it("every guest family and every special row has its own mark", () => {
    for (const f of FILTERABLE_PLACE_FAMILIES) {
      expect(FAMILY_MARKS[f.key], f.key).toBeDefined();
    }
    for (const k of ["all", "saved", "social", "near", "nearby"]) {
      expect(FAMILY_MARKS[k], k).toBeDefined();
    }
  });

  it("an unknown key falls back to the grey mark", () => {
    expect(familyMark("not_a_family")).toBe(FALLBACK_FAMILY_MARK);
  });
});
