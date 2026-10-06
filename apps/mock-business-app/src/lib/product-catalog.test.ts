// THE COPY MAY NOT CONTRADICT THE DATA (MESITA-2017).
//
// `product-catalog.ts` and the blurbs in `products.ts` are prose; nothing
// compiles them against `rewards.ts` or `PRODUCT_HALVES`. Four cards were
// caught describing a product the session had just overturned — strategy
// tiers, a single-place balance, delivery, a booking-only agent — so this
// asserts the new facts are PRESENT and the retired claims are absent. An
// empty string would pass the absence half alone, which is why both are
// asserted.
import { describe, expect, it } from "vitest";
import { PRODUCT_CATALOG_COPY } from "./product-catalog";
import { SPECS } from "./products";
import { PRODUCT_KEYS } from "./product-keys";

const blurb = (key: string) => SPECS.find((s) => s.key === key)!.blurb;

describe("the four rewritten entries", () => {
  it("visits: switches, a cap, no tiers", () => {
    const copy = PRODUCT_CATALOG_COPY.visits + " " + blurb("visits");
    expect(copy).toMatch(/switch on/i);
    expect(copy).toMatch(/cap|most a visit may cost/i);
    expect(copy).not.toMatch(/conservative|aggressive|tier/i);
  });

  it("orders: pickup from six channels, delivery only as coming", () => {
    const copy = PRODUCT_CATALOG_COPY.orders + " " + blurb("orders");
    expect(copy).toMatch(/pickup/i);
    expect(copy).toMatch(/six channels/i);
    expect(copy).toMatch(/delivery is coming/i);
    expect(blurb("orders")).not.toMatch(/delivery/i);
  });

  it("credits: campaigns, and a sister branch may honour them", () => {
    const copy = PRODUCT_CATALOG_COPY.credits + " " + blurb("credits");
    expect(copy).toMatch(/campaign/i);
    expect(copy).toMatch(/sister branch/i);
    expect(copy).not.toMatch(/cannot be spent at any other place|only spend here/i);
  });

  it("line: bookings, pickup orders, and a person to hand off to", () => {
    const copy = PRODUCT_CATALOG_COPY.line + " " + blurb("line");
    expect(copy).toMatch(/booking/i);
    expect(copy).toMatch(/pickup order/i);
    expect(copy).toMatch(/hands? a person|hands? .* to a person/i);
  });
});

describe("every card", () => {
  it("has one sentence for a blurb, ending in a period", () => {
    for (const spec of SPECS) {
      expect(spec.blurb.trim().endsWith("."), spec.key).toBe(true);
      // One sentence: no ". " inside. An em dash is a clause, not a sentence.
      expect(spec.blurb.trim().slice(0, -1)).not.toMatch(/\. /);
    }
  });

  it("has a long-form entry", () => {
    for (const key of PRODUCT_KEYS) expect(PRODUCT_CATALOG_COPY[key].length).toBeGreaterThan(80);
  });
});
