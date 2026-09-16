import { describe, expect, it } from "vitest";
import { balanceState, headlineCents, spendableAtCopy } from "@/lib/credits";

// Was credits-face.test.ts, which pinned MESITA-1816's rule: the money was the
// ORGANIZATION's, and `balanceFace` decided when the card could wear its one
// place's name and photo instead. MESITA-1892 removed the organization, so
// there is no second identity to choose between and no `balanceFace` left to
// test — one place, one balance, one face.
//
// What survived is what the balance SAYS, and those rules are real: the
// sentence, the three states, and the headline's refusal to read zero while
// there is history to show. Literal expectations, typed out — never derived
// from the function under test.

describe("spendableAtCopy", () => {
  it("names the one place the balance is spendable at", () => {
    expect(spendableAtCopy({ placeName: "Taquería X" })).toBe(
      "Spendable at Taquería X",
    );
  });
});

describe("balanceState", () => {
  it("spendable wins over pending", () => {
    expect(balanceState({ spendableCents: 100, pendingCents: 500 })).toBe(
      "spendable",
    );
  });

  it("pending is the middle state the hold brought back", () => {
    expect(balanceState({ spendableCents: 0, pendingCents: 500 })).toBe(
      "pending",
    );
  });

  it("neither means the money is dead", () => {
    expect(balanceState({ spendableCents: 0, pendingCents: 0 })).toBe("expired");
  });
});

describe("headlineCents", () => {
  it("leads with what is usable now", () => {
    expect(
      headlineCents({ spendableCents: 100, pendingCents: 500, totalCents: 600 }),
    ).toBe(100);
  });

  it("falls back to what is on its way", () => {
    expect(
      headlineCents({ spendableCents: 0, pendingCents: 500, totalCents: 500 }),
    ).toBe(500);
  });

  // The rule the card depends on: a fully expired place still shows the guest
  // what they had, rather than rendering as a balance that was never bought.
  it("never reads zero while there is history to show", () => {
    expect(
      headlineCents({ spendableCents: 0, pendingCents: 0, totalCents: 400 }),
    ).toBe(400);
  });
});
