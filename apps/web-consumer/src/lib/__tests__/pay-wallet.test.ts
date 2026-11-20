import { describe, expect, it } from "vitest";
import { addFundsOn, billRead, methodFace, payHere } from "@/lib/pay-wallet";

describe("Pay Here while a bill may be open", () => {
  it("opens that place's bill, and does not open another place", () => {
    expect(payHere("open", true)).toBe("bill");
    expect(payHere("open", false)).toBe("blocked");
    expect(payHere("clear", false)).toBe("checkout");
  });

  it("a failed visits read, a draft, or an unresolved local id does not start a second bill", () => {
    expect(billRead({ visitsOk: false, missed: false, live: 0, draft: false })).toBe("unknown");
    expect(payHere("unknown", false)).toBe("blocked");
    expect(billRead({ visitsOk: true, missed: false, live: 0, draft: true })).toBe("open");
    expect(payHere("open", false)).toBe("blocked");
    expect(billRead({ visitsOk: true, missed: true, live: 0, draft: false })).toBe("unknown");
    expect(payHere("loading", true)).toBe("blocked");
  });
});

describe("Method and Add Funds", () => {
  it("a null card list is Retry, not Add card", () => {
    expect(methodFace(undefined)).toBe("bone");
    expect(methodFace(null)).toBe("retry");
    expect(methodFace([])).toBe("add");
    expect(methodFace([{ last4: "4242" }])).toBe("card");
  });

  it("a missing card_ok does not enable Add Funds and does not decide Pay Here", () => {
    expect(addFundsOn(undefined)).toBe(false);
    expect(addFundsOn(false)).toBe(false);
    expect(addFundsOn(true)).toBe(true);
    expect(payHere("clear", false)).toBe("checkout");
  });
});
