import { describe, expect, it } from "vitest";

import { displayPlaceTagLabel } from "../place-tag-label";

describe("displayPlaceTagLabel (MESITA-963)", () => {
  it("prefers English even when Spanish is present", () => {
    expect(
      displayPlaceTagLabel({
        slug: "cash",
        label_en: "Cash",
        label_es: "Efectivo",
      }),
    ).toBe("Cash");
  });

  it("falls back to a spaced slug when English is missing", () => {
    expect(
      displayPlaceTagLabel({
        slug: "outdoor_seating",
        label_en: "",
        label_es: "Mesas al aire libre",
      }),
    ).toBe("outdoor seating");
  });

  it("trims English labels", () => {
    expect(
      displayPlaceTagLabel({ slug: "romantic", label_en: "  Romantic  " }),
    ).toBe("Romantic");
  });
});
