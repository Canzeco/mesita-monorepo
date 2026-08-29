// Cards wallet display helpers. Expiry is the one with a real edge: a card
// is good through the LAST DAY of its expiry month, so 04/2030 is still live
// on 2030-04-30 and dead on 2030-05-01. Getting that off by a month either
// greys out a working card or hides a dead one.

import { describe, expect, it } from "vitest";
import {
  formatCardExpiry,
  formatCardLabel,
  isCardExpired,
  type ConsumerCard,
} from "@/lib/api/cards";

function card(patch: Partial<ConsumerCard> = {}): ConsumerCard {
  return {
    id: "pm_1",
    brand: "visa",
    last4: "4242",
    exp_month: 4,
    exp_year: 2030,
    is_default: false,
    ...patch,
  };
}

describe("formatCardLabel", () => {
  it("capitalizes Stripe's lowercase brand and shows the last four", () => {
    expect(formatCardLabel(card())).toBe("Visa ···· 4242");
    expect(formatCardLabel(card({ brand: "mastercard" }))).toBe(
      "Mastercard ···· 4242",
    );
  });

  it("degrades to a generic label rather than rendering null", () => {
    expect(formatCardLabel(card({ brand: null }))).toBe("Card ···· 4242");
    expect(formatCardLabel(card({ brand: null, last4: null }))).toBe("Card");
  });
});

describe("isCardExpired", () => {
  it("keeps the card live through the last day of its expiry month", () => {
    expect(isCardExpired(card(), new Date(2030, 3, 30))).toBe(false);
  });

  it("expires it on the first day of the next month", () => {
    expect(isCardExpired(card(), new Date(2030, 4, 1))).toBe(true);
  });

  it("treats an incomplete expiry as not expired, never as expired", () => {
    // A missing expiry means Stripe told us nothing, not that the card is
    // dead. Greying out a working card is the worse failure.
    expect(isCardExpired(card({ exp_month: null }), new Date(2035, 0, 1))).toBe(
      false,
    );
    expect(isCardExpired(card({ exp_year: null }), new Date(2035, 0, 1))).toBe(
      false,
    );
  });
});

describe("formatCardExpiry", () => {
  it("zero-pads the month and shortens the year", () => {
    expect(formatCardExpiry(card({ exp_month: 4, exp_year: 2030 }))).toBe(
      "04/30",
    );
    expect(formatCardExpiry(card({ exp_month: 11, exp_year: 2027 }))).toBe(
      "11/27",
    );
  });

  it("returns null when there is nothing to show", () => {
    expect(formatCardExpiry(card({ exp_month: null }))).toBeNull();
  });
});
