// Money (MESITA-3305): the Pay form's split between credit and card. The
// server is the last word on both parts; this decides only what the form
// offers, and it offers a card part only where the place can take one.
import { describe, expect, it } from "vitest";
import { PAY_REFUSAL, splitPayment } from "@/lib/api/wallet";

describe("splitPayment", () => {
  it("pays from credit alone when the credit covers the bill", () => {
    expect(splitPayment(5000, 17000, true)).toEqual({ credit_cents: 5000, card_cents: 0, kind: "credit" });
    expect(splitPayment(17000, 17000, false)).toEqual({ credit_cents: 17000, card_cents: 0, kind: "credit" });
  });

  it("puts the rest on the card where the place takes cards", () => {
    expect(splitPayment(20000, 17000, true)).toEqual({ credit_cents: 17000, card_cents: 3000, kind: "mixed" });
    expect(splitPayment(500, 0, true)).toEqual({ credit_cents: 0, card_cents: 500, kind: "card" });
  });

  it("offers nothing past the credit where the place takes no cards", () => {
    expect(splitPayment(20000, 17000, false)).toEqual({ credit_cents: 17000, card_cents: 3000, kind: "over" });
  });
});

describe("the refusal copy", () => {
  it("names every code the card part can answer", () => {
    for (const code of ["below_minimum", "no_account", "cards_off", "currency_mismatch", "in_progress", "checkout_failed", "locked"]) {
      expect(PAY_REFUSAL[code], code).toBeTruthy();
    }
  });
});
