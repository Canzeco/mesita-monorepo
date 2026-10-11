import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ScrollCard, needsReflection } from "@/components/consumer/home/scroll/scroll-card";
import { testPlace } from "./fixtures/place";

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
const place = testPlace();
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
        place={place}
        index={0}
        total={12}
        near
        cardSize={phone}
        saved={false}
        profileHref="/place/taqueria-test"
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

// SCROLL IS SWIPE, VERTICAL (Pato, MESITA-2147: "scroll must have the same
// boxes as swipe" and "reserve button must be as equal as the others").
describe("Scroll states a place with Swipe's boxes", () => {
  const html = () =>
    renderToStaticMarkup(
      <ScrollCard
        place={place}
        index={0}
        total={12}
        near
        cardSize={phone}
        saved={false}
        profileHref="/place/taqueria-test"
        onToggleSave={() => {}}
        onShare={() => {}}
        onReserve={() => {}}
      />,
    );

  it("renders SwipeCardInfo, not its own text lines", () => {
    const src = read("components/consumer/home/scroll/scroll-card.tsx");
    expect(src).toContain("<SwipeCardInfo place={place} compact />");
    expect(src).not.toContain("metaLine");
    // Swipe's chip shape: bordered dark boxes.
    expect(html()).toContain("border-white/35 bg-black/60");
  });

  it("draws Reserve on the same disc as Profile, Save and Share", () => {
    const discs = [...html().matchAll(/<span class="(bg-media-glass[^"]*)"/g)].map(
      (m) => m[1],
    );
    expect(discs.length).toBe(4);
    expect(new Set(discs.map((d) => d.replace(/ scale-110/, ""))).size).toBe(1);
    expect(html()).not.toContain("bg-on-media text-foreground");
  });
});
