import { describe, expect, it } from "vitest";
import { addFundsOn, billRead, methodFace, payHere } from "@/lib/pay-wallet";

describe("Pay while a bill may be open", () => {
  it("only a clear read starts a checkout; an open bill is where every Pay lands", () => {
    expect(payHere("clear")).toBe("checkout");
    expect(payHere("open")).toBe("bill");
  });

  it("a failed visits read, a draft, or an unresolved local id does not start a second bill", () => {
    expect(billRead({ visitsOk: false, missed: false, live: 0, draft: false })).toBe("unknown");
    expect(payHere("unknown")).toBe("recheck");
    expect(billRead({ visitsOk: true, missed: false, live: 0, draft: true })).toBe("open");
    expect(payHere("open")).toBe("bill");
    expect(billRead({ visitsOk: true, missed: true, live: 0, draft: false })).toBe("unknown");
    expect(payHere("loading")).toBe("wait");
  });
});

describe("Method and Add Funds", () => {
  it("a null card list is Retry, not Add card", () => {
    expect(methodFace(undefined)).toBe("bone");
    expect(methodFace(null)).toBe("retry");
    expect(methodFace([])).toBe("add");
    expect(methodFace([{ last4: "4242" }])).toBe("card");
  });

  it("a missing card_ok does not enable Add Funds and does not decide Pay", () => {
    expect(addFundsOn(undefined)).toBe(false);
    expect(addFundsOn(false)).toBe(false);
    expect(addFundsOn(true)).toBe(true);
    expect(payHere("clear")).toBe("checkout");
  });
});
