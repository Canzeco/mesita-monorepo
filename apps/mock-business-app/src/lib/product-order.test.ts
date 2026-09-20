// THE ELEVEN, PINNED (MESITA-2017).
//
// `PRODUCT_ORDER` is a product decision Pato made out loud, and `satisfies`
// only refuses a key that is not a product — it cannot refuse a row that
// moved. This is the assertion that refuses the move: the literal below is
// the dictation of 2026-09-20, and the day it changes, this file changes in
// the same commit with the reason.
import { describe, expect, it } from "vitest";
import { PRODUCT_ORDER, PRODUCT_SLUG, productFromSlug } from "./product-routes";
import { PRODUCT_KEYS } from "./product-keys";
import { PRODUCT_HALVES } from "./product-halves";

describe("the v1 product order", () => {
  it("is the eleven Pato approved at the gate, in that order", () => {
    expect([...PRODUCT_ORDER]).toEqual([
      "profile",
      "partner",
      "reviews",
      "menu",
      "visits",
      "orders",
      "reservations",
      "pay",
      "credits",
      "website",
      "line",
    ]);
  });

  it("leaves the twenty-key vocabulary where it was", () => {
    // The order is a SUBSET of the vocabulary, never a re-sort of it: the
    // catalogue's bands are slices of `PRODUCT_KEYS` and would tear if the
    // vocabulary moved to follow the menu.
    expect(PRODUCT_KEYS).toHaveLength(20);
    for (const key of PRODUCT_ORDER) expect(PRODUCT_KEYS).toContain(key);
  });

  it("gives every row at least one half, so no menu row can 404", () => {
    for (const key of PRODUCT_ORDER) expect(PRODUCT_HALVES[key].length).toBeGreaterThan(0);
  });

  it("round-trips every slug", () => {
    for (const key of PRODUCT_KEYS) expect(productFromSlug(PRODUCT_SLUG[key])).toBe(key);
    expect(productFromSlug("not-a-product")).toBeNull();
  });
});
