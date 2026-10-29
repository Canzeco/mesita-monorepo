import { describe, expect, it } from "vitest";
import { estimateLabelRect, pickVisiblePinLabels } from "./map-pin-labels";

describe("estimateLabelRect (MESITA-2748)", () => {
  it("parks the name to the right of the pin, vertically centered", () => {
    const rect = estimateLabelRect(100, 80, "McDonald's");
    expect(rect.left).toBeGreaterThan(100);
    expect(rect.top).toBeLessThan(80);
    expect(rect.bottom).toBeGreaterThan(80);
  });
});

describe("pickVisiblePinLabels (d4a)", () => {
  it("always shows the focused pin even when it overlaps another label", () => {
    const candidates = [
      { id: "a", title: "Alpha Bistro", x: 100, y: 100, focused: false },
      { id: "b", title: "Beta Kitchen", x: 102, y: 102, focused: true },
    ];
    const visible = pickVisiblePinLabels(candidates);
    expect(visible.has("b")).toBe(true);
  });

  it("drops non-focused labels that collide with an earlier one", () => {
    const candidates = [
      {
        id: "a",
        title: "Alpha Bistro Long Name",
        x: 200,
        y: 200,
        focused: false,
      },
      {
        id: "b",
        title: "Beta Kitchen Long Name",
        x: 205,
        y: 205,
        focused: false,
      },
    ];
    const visible = pickVisiblePinLabels(candidates);
    expect(visible.size).toBe(1);
    expect(visible.has("a")).toBe(true);
  });

  it("keeps two names that sit far apart", () => {
    const candidates = [
      { id: "a", title: "Carl's Jr.", x: 40, y: 40, focused: false },
      { id: "b", title: "Subway", x: 280, y: 240, focused: false },
    ];
    const visible = pickVisiblePinLabels(candidates);
    expect(visible.size).toBe(2);
  });
});
