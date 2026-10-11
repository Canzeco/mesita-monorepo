import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ScrollCard, needsReflection } from "@/components/consumer/home/scroll/scroll-card";
import { scrollMockPlaces } from "@/lib/mock/scroll-places";
import type { Place } from "@/lib/api/places";

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
const mock = scrollMockPlaces()[0] as Place;
const phone = { width: 390, height: 671 };

describe("one threshold decides cover or reflection", () => {
  it("tall photos cover; square and wide ones reflect", () => {
    expect(needsReflection(9 / 16, phone)).toBe(false);
    expect(needsReflection(3 / 4, phone)).toBe(false);
    expect(needsReflection(1, phone)).toBe(true);
    expect(needsReflection(3 / 2, phone)).toBe(true);
  });
});

describe("Scroll", () => {
  it("paints the gradient while the photo's shape is unknown (it covers first)", () => {
    const html = renderToStaticMarkup(
      <ScrollCard
        place={mock}
        index={0}
        total={12}
        near
        cardSize={phone}
        saved={false}
        profileHref={null}
        onProfile={() => {}}
        onToggleSave={() => {}}
        onShare={() => {}}
        onReserve={() => {}}
      />,
    );
    expect(html).toContain("data-scrim");
  });

  it("drops the gradient when the photo on screen reflects", () => {
    const src = read("components/consumer/home/scroll/scroll-card.tsx");
    expect(src).toMatch(/onIdxChange=\{setActiveIdx\}/);
    expect(src).toMatch(/needsReflection\(activeRatio, cardSize\)/);
    expect(src).toMatch(/\{!reflected && \(/);
  });
});

describe("Swipe", () => {
  it("reads the mode of the photo on screen, not the first one", () => {
    const src = read("components/consumer/PlaceSwipeCardFace.tsx");
    expect(src).toContain("onIdxChange={setActivePhotoIdx}");
    expect(src).toMatch(/place\.photos\[activePhotoIdx\]/);
  });

  it("only the cover mode draws the gradient", () => {
    const src = read("components/consumer/SwipeCardFieldsLayer.tsx");
    expect(src).toMatch(/\{!split && \(\s*<div className="absolute inset-0 bg-gradient-to-t/);
  });
});

describe("the carousel reports the photo on screen", () => {
  it("calls onIdxChange when the page changes", () => {
    const src = read("components/consumer/ImageCarousel.tsx");
    expect(src).toMatch(/setIdx\(i\);\s*onIdxChange\?\.\(i\);/);
  });
});
