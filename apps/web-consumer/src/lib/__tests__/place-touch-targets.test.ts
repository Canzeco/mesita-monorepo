// Every tappable control on the place profile is at least 44px tall
// (MESITA-2324). Tailwind h-11 / min-h-11 = 44px; h-9 / h-10 are not.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PKG = join(__dirname, "../../../../../packages/place-profile/src/components");
const SRC = join(__dirname, "../..");
const read = (p: string) => readFileSync(p, "utf8");

describe("place profile touch targets", () => {
  it("Save · Share · Directions are 44px and Reserve is 48px (MESITA-2441)", () => {
    const actions = read(join(PKG, "place-detail/ProfileActions.tsx"));
    expect(actions).toContain("flex min-h-11 min-w-0 flex-1");
    expect(actions).toContain("flex h-11 w-11 items-center");
    expect(actions).toContain("inline-flex h-12 w-full");
    expect(actions).not.toMatch(/\bh-(9|10)\b/);
  });

  it("the back button and its spacer are 44px, in the package and in the consumer", () => {
    for (const file of [
      join(PKG, "PlaceProfile.tsx"),
      join(SRC, "components/consumer/PlaceDetailPageHeader.tsx"),
      join(SRC, "components/consumer/overlay/SlideOverShell.tsx"),
    ]) {
      const src = read(file);
      expect(src, file).toContain("h-11 w-11");
      expect(src, file).not.toContain("h-9 w-9");
    }
  });

  it("Try again, Menus' View, the Popular times days and the Hours row are 44px", () => {
    expect(read(join(PKG, "place-detail/location-hours.tsx"))).toContain("min-h-11");
    expect(read(join(PKG, "place-detail/PlaceCreatingPanel.tsx"))).toContain("min-h-11");
    expect(read(join(PKG, "place-detail/menus.tsx"))).toContain("min-h-11");
    expect(read(join(PKG, "place-detail/popular-times.tsx"))).toContain("min-h-11");
  });
});
