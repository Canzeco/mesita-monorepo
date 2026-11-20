// Money and auth (MESITA-3799, MESITA-4485): a click signs. A half-typed code
// does not. Cash still waits for Yes, and Yes means exactly the owed cash.
import { describe, expect, it } from "vitest";
import { signRequest, waiterCode } from "./sign-gate";

const base = { owedCents: 0, cashAnswer: null, typedCode: "123456", cardPending: false } as const;

describe("signRequest", () => {
  it("a click signs; a half-typed code does not", () => {
    expect(waiterCode("12 34 56")).toBe("123456");
    expect(signRequest({ ...base, typedCode: "" })).toEqual({ place_code: null, cash_received_cents: null });
    for (const typedCode of ["12345", "1234567", "12345a"]) {
      expect(signRequest({ ...base, typedCode })).toBeNull();
    }
  });

  it("paid in the app: the code alone signs, with no cash", () => {
    expect(signRequest(base)).toEqual({ place_code: "123456", cash_received_cents: null });
  });

  it("cash owed: no answer or No never signs; Yes sends exactly what is owed", () => {
    expect(signRequest({ ...base, owedCents: 25000 })).toBeNull();
    expect(signRequest({ ...base, owedCents: 25000, cashAnswer: "no" })).toBeNull();
    expect(signRequest({ ...base, owedCents: 25000, cashAnswer: "yes" })).toEqual({
      place_code: "123456",
      cash_received_cents: 25000,
    });
  });

  it("never signs while the card is still going through", () => {
    expect(signRequest({ ...base, cardPending: true })).toBeNull();
    expect(signRequest({ ...base, owedCents: 500, cashAnswer: "yes", cardPending: true })).toBeNull();
  });
});
