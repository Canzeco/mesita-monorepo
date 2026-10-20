import { describe, expect, it } from "vitest";
import {
  cardPhoto,
  firstGuestFamily,
  placePlaceholder,
} from "@/lib/place-placeholder";

describe("a Google-only card never shows a photo (MESITA-2298)", () => {
  it("drops the photo for a Google-only row, keeps it for a Mesita place", () => {
    const photos = ["https://example.com/a.jpg"];
    expect(cardPhoto({ name: "Casa", photos, googleOnly: true })).toBeUndefined();
    expect(cardPhoto({ name: "Casa", photos, from_google: true })).toBeUndefined();
    expect(cardPhoto({ name: "Casa", photos })).toBe(photos[0]);
  });
});

describe("the placeholder is the family's line icon, then the initial (MESITA-2478)", () => {
  it("resolves the first guest family", () => {
    expect(firstGuestFamily(["coffee"])).toBe("coffee");
    expect(firstGuestFamily(["undefined", "tacos"])).toBe("tacos");
    expect(firstGuestFamily(["undefined"])).toBeNull();
    expect(firstGuestFamily(["nope"])).toBeNull();
    expect(firstGuestFamily(null)).toBeNull();
  });

  it("a Google-only row with a family draws that family's icon", () => {
    expect(
      placePlaceholder({ name: "Casa", family_keys: ["pizza"], googleOnly: true }),
    ).toEqual({ kind: "family", family: "pizza" });
  });

  it("falls back to the initial when no family resolves, and for Mesita places", () => {
    expect(
      placePlaceholder({ name: "casa", family_keys: [], googleOnly: true }),
    ).toEqual({ kind: "initial", text: "C" });
    expect(placePlaceholder({ name: "Nectar", family_keys: ["coffee"] })).toEqual({
      kind: "initial",
      text: "N",
    });
  });
});
