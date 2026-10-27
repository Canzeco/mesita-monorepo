import { describe, expect, it } from "vitest";

import { resolvePlaceDisplayName } from "./place-to-detail-helpers";

describe("resolvePlaceDisplayName", () => {
  it("shows the one Mesita name (MESITA-2828)", () => {
    expect(
      resolvePlaceDisplayName({
        name: "Starbucks Himalaya",
        google_name: "Starbucks Coffee Himalaya #4521",
      }),
    ).toBe("Starbucks Himalaya");
  });

  it("never reads google_name when name is absent", () => {
    expect(
      resolvePlaceDisplayName({
        google_name: "Google Only Label",
      }),
    ).toBe("Place");
  });
});
