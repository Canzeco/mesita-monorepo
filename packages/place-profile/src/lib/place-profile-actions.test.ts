import { describe, expect, it } from "vitest";

import { isReservable, isReserveActionEnabled } from "./place-profile-actions";

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

// MESITA-3622: one switch AND one number.
describe("isReservable", () => {
  it("needs the switch on and a number to call", () => {
    expect(isReservable({ reservations_enabled: true, phone: "+528183782164" })).toBe(true);
    expect(isReservable({ reservations_enabled: true, reservation_target: "+528111111111" })).toBe(true);
    expect(isReservable({ reservations_enabled: true, phone: " " })).toBe(false);
    expect(isReservable({ reservations_enabled: false, phone: "+528183782164" })).toBe(false);
  });

  it("takes the server's answer when it sends one", () => {
    expect(isReservable({ reservable: true, reservations_enabled: true })).toBe(true);
    expect(isReservable({ reservable: false, reservations_enabled: true, phone: "+528183782164" })).toBe(false);
  });
});
