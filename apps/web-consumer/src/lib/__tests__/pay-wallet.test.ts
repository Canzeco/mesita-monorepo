import { describe, expect, it } from "vitest";
import { billRead, defaultMethod, methodFace, payHere, pickCard } from "@/lib/pay-wallet";
import type { SavedCard } from "@/lib/api/cards";

// MESITA-4526: the default way to pay decides which card or wallet checkout
// charges, so a wrong answer is a wrong charge.
describe("The default way to pay", () => {
  const now = new Date("2026-11-21T12:00:00Z");
  const card = (id: string, exp_year = 2030, exp_month = 8): SavedCard => ({ id, brand: "visa", last4: id.slice(-4), exp_month, exp_year, in_use: false });
  const a = card("pm_aaaa");
  const b = card("pm_bbbb");
  const old = card("pm_old0", 2025, 1);

  it("a stored card, or nothing stored, is the first usable card", () => {
    expect(defaultMethod("card", [a, b], false, null, now)).toEqual({ kind: "card", card: a });
    expect(defaultMethod(null, [a, b], false, null, now)).toEqual({ kind: "card", card: a });
    expect(defaultMethod("junk", [a], false, null, now)).toEqual({ kind: "card", card: a });
  });

  it("the remembered card wins while it is saved and usable; a removed one falls back", () => {
    expect(defaultMethod("card", [a, b], false, "pm_bbbb", now)).toEqual({ kind: "card", card: b });
    expect(defaultMethod("card", [a], false, "pm_bbbb", now)).toEqual({ kind: "card", card: a });
    expect(defaultMethod("card", [old, a], false, "pm_old0", now)).toEqual({ kind: "card", card: a });
  });

  it("an expired card is never the default; no usable card is null", () => {
    expect(defaultMethod("card", [old], false, null, now)).toBeNull();
    expect(defaultMethod("card", [], false, null, now)).toBeNull();
    expect(defaultMethod(null, [], false, null, now)).toBeNull();
  });

  it("a stored wallet is the default only in a browser that has it", () => {
    expect(defaultMethod("apple_pay", [a], true, null, now)).toEqual({ kind: "apple_pay" });
    expect(defaultMethod("apple_pay", [a], false, null, now)).toEqual({ kind: "card", card: a });
    expect(defaultMethod("google_pay", [], false, null, now)).toEqual({ kind: "google_pay" });
    expect(defaultMethod("google_pay", [a], true, null, now)).toEqual({ kind: "card", card: a });
    expect(defaultMethod("google_pay", [], true, null, now)).toBeNull();
  });
});

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

describe("Method", () => {
  it("a null card list is Retry, not Add card", () => {
    expect(methodFace(undefined)).toBe("bone");
    expect(methodFace(null)).toBe("retry");
    expect(methodFace([])).toBe("add");
    expect(methodFace([{ last4: "4242" }])).toBe("card");
  });

  it("a clear bill read starts a checkout", () => {
    expect(payHere("clear")).toBe("checkout");
  });
});

// Moved from pay-cards.test.ts (MESITA-4708): the card a voucher checkout
// preselects.
describe("pickCard", () => {
  const card = (id: string): SavedCard => ({ id, brand: "visa", last4: "4242", exp_month: 8, exp_year: 2029, in_use: false });
  it("keeps the remembered card while it is saved", () => {
    expect(pickCard([card("a"), card("b")], "b")).toBe("b");
  });
  it("falls back to the first card, or none, when the remembered one is gone", () => {
    expect(pickCard([card("a")], "gone")).toBe("a");
    expect(pickCard([], "gone")).toBeNull();
  });
  it("picks nothing while the list is unknown, and never the excluded card by default", () => {
    expect(pickCard(null, "a")).toBeNull();
    expect(pickCard([card("a"), card("b")], "a", "a")).toBe("b");
  });
});
