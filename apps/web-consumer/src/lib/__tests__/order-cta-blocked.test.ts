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
  it("explains staged ordering, not a missing menu", () => {
    expect(ORDER_BLOCKED.aria).toBe("Ordering isn't available at this place yet");
    expect(ORDER_BLOCKED.title).toContain("isn't live yet");
    expect(ORDER_BLOCKED.title).toContain("pickup");
    expect(ORDER_BLOCKED.title.toLowerCase()).not.toContain("table");
    expect(ORDER_BLOCKED.hint.toLowerCase()).toContain("menu");
  });
});

describe("RESERVE_BLOCKED copy", () => {
  it("explains walk-in places", () => {
    expect(RESERVE_BLOCKED.hint).toContain("Walk-in");
  });
});

describe("CREDITS_BLOCKED copy", () => {
  it("blames the unbuilt engine, not the place", () => {
    expect(CREDITS_BLOCKED.title).toContain("coming soon");
    expect(CREDITS_BLOCKED.hint).toContain("Coming soon");
    // "this place" is how ORDER_BLOCKED phrases a place-side gap. Credits is
    // parked product-wide, so borrowing that phrasing would misplace the
    // blame on every place in the app.
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

describe("Order CTA contract (MESITA-1967)", () => {
  it("stays disabled for menu-on-file until the order rail ships", async () => {
    const { isOrderActionEnabled } = await import("@/lib/place-profile-actions");
    expect(
      isOrderActionEnabled({
        orders_enabled: true,
        menu_pdf_url: "https://example.com/menu.pdf",
      }),
    ).toBe(false);
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

// MVP CUT (Pato, MESITA-2077). Credits · Visit · Order are money or not
// built, so both surfaces hide them behind ONE flag and draw Reserve alone.
// Both must read the same flag, or the bar and the sheet disagree.
describe("MVP cut parks the money actions on both surfaces", () => {
  it("is on", async () => {
    const copy = await import(
      "@/components/consumer/place-detail/place-actions-copy"
    );
    expect(copy.MONEY_ACTIONS_PARKED).toBe(true);
  });

  it("gates Credits, Visit and Order on the flag in the bar and the sheet", () => {
    for (const file of ["PlaceActionBar.tsx", "GoSheet.tsx"]) {
      const src = read(file);
      expect(src, file).toContain("{MONEY_ACTIONS_PARKED ? null : (");
      const parked = src.slice(
        src.indexOf("{MONEY_ACTIONS_PARKED ? null : ("),
        src.indexOf("</>"),
      );
      for (const verb of ["Credits", "Visit", "Order"]) {
        expect(parked, `${file} ${verb}`).toMatch(new RegExp(`\\b${verb}\\b`));
      }
      expect(parked, file).not.toMatch(/\bReserve\b/);
    }
  });

  // Bugbot on #2056: a walk-in place had nothing left to offer but a disabled
  // Reserve under "Book a table." Both surfaces must read reserveEnabled.
  it("drops the lone disabled Reserve at walk-in places", () => {
    expect(read("PlaceActionBar.tsx")).toContain(
      "if (MONEY_ACTIONS_PARKED && !reserveEnabled) return null;",
    );
    const go = read("GoSheet.tsx");
    expect(go).toContain("{MONEY_ACTIONS_PARKED && !reserveEnabled ? null : (");
    expect(go).toContain(": RESERVE_BLOCKED.hint}");
  });
});
