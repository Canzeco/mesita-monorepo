import { describe, expect, it } from "vitest";

import {
  isOrderActionEnabled,
  isReserveActionEnabled,
} from "@/lib/place-profile-actions";

describe("isReserveActionEnabled", () => {
  it("offers Reserve unless the place has explicitly opted out", () => {
    expect(isReserveActionEnabled({ reservations_enabled: true })).toBe(true);
    expect(isReserveActionEnabled({})).toBe(true);
    expect(isReserveActionEnabled(undefined)).toBe(true);
    expect(isReserveActionEnabled({ reservations_enabled: null })).toBe(true);
  });

  it("locks Reserve when the stored bit is false (Not / walk-in)", () => {
    expect(isReserveActionEnabled({ reservations_enabled: false })).toBe(false);
  });
});

describe("isOrderActionEnabled stays fail-closed until the order rail ships", () => {
  it("ignores menu-on-file and enricher orders_enabled (MESITA-1967)", () => {
    expect(isOrderActionEnabled({})).toBe(false);
    expect(isOrderActionEnabled({ orders_enabled: false })).toBe(false);
    expect(isOrderActionEnabled({ orders_enabled: true })).toBe(false);
    expect(
      isOrderActionEnabled({
        orders_enabled: true,
        menu_pdf_url: "https://m.pdf",
      }),
    ).toBe(false);
  });
});
