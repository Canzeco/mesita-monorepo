import { describe, expect, it } from "vitest";

import {
  DOUBLE_TAP_MS,
  DOUBLE_TAP_SLOP_PX,
  TAP_MOVE_PX,
  isDoubleTap,
  isTap,
} from "@/components/consumer/home/scroll/use-double-tap";

// Double-tap saves on Scroll (MESITA-2105, design 4A), and the photo under it
// is a native sideways scroller. The one thing this must never do is read a
// swipe as a tap — that would save a place the guest only paged past.
describe("Scroll's double tap", () => {
  const at = (x: number, y: number, t: number) => ({ x, y, t });

  it("a short, still press is a tap", () => {
    expect(isTap(at(100, 100, 0), at(100, 100, 120))).toBe(true);
    expect(isTap(at(100, 100, 0), at(100 + TAP_MOVE_PX, 100, 120))).toBe(true);
  });

  it("a drag or a long press is not a tap", () => {
    expect(isTap(at(100, 100, 0), at(100 + TAP_MOVE_PX + 1, 100, 120))).toBe(false);
    expect(isTap(at(100, 100, 0), at(160, 100, 90))).toBe(false); // a swipe
    expect(isTap(at(100, 100, 0), at(100, 100, DOUBLE_TAP_MS + 1))).toBe(false);
  });

  it("two taps close in time and space are a double tap", () => {
    expect(isDoubleTap(at(100, 100, 0), at(110, 105, 200))).toBe(true);
    expect(isDoubleTap(at(100, 100, 0), at(100, 100, DOUBLE_TAP_MS))).toBe(true);
  });

  it("too slow, too far, or no first tap is not", () => {
    expect(isDoubleTap(at(100, 100, 0), at(100, 100, DOUBLE_TAP_MS + 1))).toBe(false);
    expect(
      isDoubleTap(at(100, 100, 0), at(100 + DOUBLE_TAP_SLOP_PX + 1, 100, 150)),
    ).toBe(false);
    expect(isDoubleTap(null, at(100, 100, 150))).toBe(false);
  });
});
