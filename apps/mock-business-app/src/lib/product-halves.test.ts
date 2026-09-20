// THE MAP IS THE ROUTER, SO THE MAP IS PINNED (MESITA-2017).
//
// A product declared BOTH with no Activity block renders an empty pane; a
// product declared SETUP_ONLY that grew an Activity block 404s its own log.
// The compiler sees neither. This says which products have two halves, and
// the day a view grows or loses a half this file changes with it.
import { describe, expect, it } from "vitest";
import { PRODUCT_HALVES, hasHalf, isSplit, primaryHalf } from "./product-halves";
import { PRODUCT_KEYS } from "./product-keys";

describe("the halves", () => {
  it("are BOTH for the eight products with a log of their own", () => {
    const both = PRODUCT_KEYS.filter((k) => isSplit(k)).sort();
    expect(both).toEqual(
      ["access", "credits", "line", "orders", "pay", "reservations", "reviews", "visits"].sort(),
    );
  });

  it("give every product at least one half, and the first is what its row opens", () => {
    for (const key of PRODUCT_KEYS) {
      expect(PRODUCT_HALVES[key].length).toBeGreaterThan(0);
      expect(hasHalf(key, primaryHalf(key))).toBe(true);
    }
  });

  it("keep the config-only products on one screen", () => {
    for (const key of ["profile", "partner", "menu", "website"] as const) {
      expect(PRODUCT_HALVES[key]).toEqual(["products"]);
    }
  });
});
