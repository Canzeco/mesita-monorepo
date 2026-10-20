import { describe, expect, it } from "vitest";
import { Users, Utensils } from "lucide-react";
import {
  FAMILY_ICONS,
  FALLBACK_FAMILY_ICON,
  Taco,
  familyIcon,
} from "@/lib/family-icons";
import { FILTERABLE_PLACE_FAMILIES } from "@/lib/place-families";

// The consumer's family marks are line icons, never emoji (MESITA-2478).
describe("family icons (MESITA-2478)", () => {
  it("every guest family and the four pinned rows has its own icon", () => {
    for (const f of FILTERABLE_PLACE_FAMILIES) {
      expect(FAMILY_ICONS[f.key], f.key).toBeDefined();
    }
    for (const k of ["all", "social", "saved", "near", "popular"]) {
      expect(FAMILY_ICONS[k], k).toBeDefined();
    }
    expect(familyIcon("social")).toBe(Users);
    expect(familyIcon("tacos")).toBe(Taco);
  });

  it("an unknown family falls back to Utensils", () => {
    expect(FALLBACK_FAMILY_ICON).toBe(Utensils);
    expect(familyIcon("undefined")).toBe(Utensils);
    expect(familyIcon("not_a_family")).toBe(Utensils);
  });
});
