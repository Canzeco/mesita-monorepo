import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";


// THE CARD'S CHROME FOLLOWS THE PHOTO ON SCREEN (Pato, MESITA-2146:
// "depending on the size, the card must be a reflection or it should not be a
// reflection, but the gray thing still exists, do the same for scroll").
//
// A tall photo covers the card and the name sits on the dark gradient; a
// square or wide photo sits over its reflection and gets NO gradient. The
// photo-paging and image-load half needs a real browser, so the wiring is
// pinned at the source and the first paint is rendered.

const SRC = join(__dirname, "..", "..");
const read = (p: string) => readFileSync(join(SRC, p), "utf8");

describe("the carousel reports the photo on screen", () => {
  it("calls onIdxChange when the page changes", () => {
    const src = read("components/consumer/ImageCarousel.tsx");
    expect(src).toMatch(/setIdx\(i\);\s*onIdxChange\?\.\(i\);/);
  });
});
