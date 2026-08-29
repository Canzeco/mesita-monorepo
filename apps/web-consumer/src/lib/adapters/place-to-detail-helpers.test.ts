import { describe, expect, it } from "vitest";

import { resolvePlaceDisplayName } from "./place-to-detail-helpers";

describe("resolvePlaceDisplayName", () => {
  it("prefers mesita_name over google_name and generated name", () => {
    expect(
      resolvePlaceDisplayName({
        mesita_name: "Starbucks",
        name: "Starbucks Himalaya",
        google_name: "Starbucks Himalaya",
      }),
    ).toBe("Starbucks");
  });

  it("falls back to generated name when mesita_name is empty", () => {
    expect(
      resolvePlaceDisplayName({
        mesita_name: null,
        name: "Contramar",
        google_name: "Contramar Seafood",
      }),
    ).toBe("Contramar");
  });

  it("never reads google_name when mesita_name and name are absent", () => {
    expect(
      resolvePlaceDisplayName({
        google_name: "Google Only Label",
      }),
    ).toBe("Place");
  });
});
