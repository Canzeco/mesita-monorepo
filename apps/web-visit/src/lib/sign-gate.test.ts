// Money and auth (MESITA-3799, MESITA-4521): Confirm sends only with a 6-digit
// waiter code, only after "Yes" when cash is owed, and Yes means exactly the
// owed cash. A click with no code never confirms.
import { describe, expect, it } from "vitest";
import { signRequest, waiterCode } from "./sign-gate";

const base = { owedCents: 0, cashAnswer: null, typedCode: "123456", cardPending: false } as const;

describe("signRequest", () => {
  it("needs a 6-digit waiter code; a click alone never confirms", () => {
    expect(waiterCode("123 456")).toBe("123456");
    for (const typedCode of ["", "123", "12345", "1234567", "12345a"]) {
      expect(signRequest({ ...base, typedCode })).toBeNull();
    }
  });

  it("paid in the app: the code alone confirms, with no cash", () => {
    expect(signRequest(base)).toEqual({ place_code: "123456", cash_received_cents: null });
  });

  it("cash owed: no answer or No never confirms; Yes sends exactly what is owed", () => {
    expect(signRequest({ ...base, owedCents: 25000 })).toBeNull();
    expect(signRequest({ ...base, owedCents: 25000, cashAnswer: "no" })).toBeNull();
    expect(signRequest({ ...base, owedCents: 25000, cashAnswer: "yes" })).toEqual({
      place_code: "123456",
      cash_received_cents: 25000,
    });
  });

  it("never confirms while the card is still going through", () => {
    expect(signRequest({ ...base, cardPending: true })).toBeNull();
    expect(signRequest({ ...base, owedCents: 500, cashAnswer: "yes", cardPending: true })).toBeNull();
  });
});
