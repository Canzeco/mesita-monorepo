// Guard kept: a Google-only card never shows a photo (Mesita holds no hero for it).
import { describe, expect, it } from "vitest";
import { cardPhoto } from "@/lib/place-placeholder";

describe("a Google-only card never shows a photo (MESITA-2298)", () => {
  it("drops the photo for a Google-only row, keeps it for a Mesita place", () => {
    const photos = ["https://example.com/a.jpg"];
    expect(cardPhoto({ name: "Casa", photos, googleOnly: true })).toBeUndefined();
    expect(cardPhoto({ name: "Casa", photos, from_google: true })).toBeUndefined();
    expect(cardPhoto({ name: "Casa", photos })).toBe(photos[0]);
  });
});
