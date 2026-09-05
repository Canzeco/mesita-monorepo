// Order / Reserve CTAs follow Description → Actions flags.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import {
  CREDITS_BLOCKED,
  ORDER_BLOCKED,
  RESERVE_BLOCKED,
} from "@/components/consumer/place-detail/place-actions-copy";

const DIR = join(__dirname, "../../components/consumer/place-detail");
const read = (file: string) => readFileSync(join(DIR, file), "utf8");

describe("ORDER_BLOCKED copy", () => {
  it("explains missing menu, not a global coming-soon", () => {
    expect(ORDER_BLOCKED.aria).toBe("Ordering isn't available at this place yet");
    expect(ORDER_BLOCKED.title).toContain("menu");
  });
});

describe("RESERVE_BLOCKED copy", () => {
  it("explains walk-in venues", () => {
    expect(RESERVE_BLOCKED.hint).toContain("Walk-in");
  });
});

describe("CREDITS_BLOCKED copy", () => {
  it("blames the unbuilt engine, not the venue", () => {
    expect(CREDITS_BLOCKED.title).toContain("coming soon");
    expect(CREDITS_BLOCKED.hint).toContain("Coming soon");
    // "this place" is how ORDER_BLOCKED phrases a venue-side gap. Credits is
    // parked product-wide, so borrowing that phrasing would misplace the
    // blame on every venue in the app.
    expect(CREDITS_BLOCKED.title).not.toContain("this place");
  });
});

describe("Credits stays locked while its engine is parked", () => {
  it("has no enable helper to gate on", async () => {
    const actions = await import("@/lib/place-profile-actions");
    expect(actions).not.toHaveProperty("isCreditsActionEnabled");
  });

  it("renders Credits disabled on both surfaces", () => {
    for (const file of ["PlaceActionBar.tsx", "GoSheet.tsx"]) {
      const src = read(file);
      expect(src).toContain("CREDITS_BLOCKED");
      expect(src).not.toContain("creditsEnabled");
      expect(src).not.toContain("credits_enabled");
    }
  });
});

describe("PlaceActionBar gates Order and Reserve", () => {
  const src = read("PlaceActionBar.tsx");

  it("does not open a coming-soon modal", () => {
    expect(src).not.toContain("ComingSoonModal");
  });

  it("reads orders_enabled via isOrderActionEnabled", () => {
    expect(src).toContain("isOrderActionEnabled");
    expect(src).toContain("orderEnabled");
  });

  it("reads reservations_enabled via isReserveActionEnabled", () => {
    expect(src).toContain("isReserveActionEnabled");
    expect(src).toContain("reserveEnabled");
  });

  // Four cells, stacked. "Reserve" beside a 16px icon measures 74.6px, but
  // four cells in this bar get 66.0px at 320px — a horizontal cell overflows
  // the narrowest phones. Stacked it needs only the 51.3px label.
  it("lays the four verbs out as stacked cells", () => {
    expect(src).toContain("grid-cols-4");
    expect(src).not.toContain("grid-cols-3");
    expect(src).toContain("flex-col");
  });
});

describe("GoSheet gates Order and Reserve", () => {
  const src = read("GoSheet.tsx");

  it("does not open a coming-soon modal", () => {
    expect(src).not.toContain("ComingSoonModal");
  });

  it("uses the same action helpers", () => {
    expect(src).toContain("isOrderActionEnabled");
    expect(src).toContain("isReserveActionEnabled");
  });

  // The bar and the sheet answer the same question, so a drift in the count
  // is a bug in whichever one moved alone.
  it("offers the same number of ways in as the bar", () => {
    expect(src).toContain("Four ways in");
  });
});
