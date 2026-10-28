import { describe, expect, it } from "vitest";

import { isReserveActionEnabled } from "./place-profile-actions";

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
