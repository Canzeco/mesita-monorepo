import { describe, expect, it } from "vitest";
import type { SavedCard } from "@/lib/api/cards";
import { acceptCardsAnswer, cardsFailure, fixedMethod, loadedCards, methodsWaitOnCards, pickCard } from "@/lib/pay-cards";

// Money (MVP test rule): a failed card read must never read as "no cards"
// (a guest with cards at a card-only place could not pay), and a late card
// list must never turn a cash payment into a card charge (MESITA-3758).

const card = (id: string): SavedCard => ({ id, brand: "visa", last4: "4242", exp_month: 8, exp_year: 2029, in_use: false });

describe("cardsFailure", () => {
  it("only a 401 is a dead session", () => {
    expect(cardsFailure({ status: 401 })).toEqual({ state: "signed_out" });
  });
  it("no response and a server error are Retry, never empty", () => {
    for (const err of [{ status: null }, { status: 500 }, { status: 503 }, new Error("network"), null, undefined]) {
      const load = cardsFailure(err);
      expect(load).toEqual({ state: "failed" });
      expect(loadedCards(load)).toBeNull();
    }
  });
  it("another refusal is not a sign-out", () => {
    expect(cardsFailure({ status: 403 })).toEqual({ state: "failed" });
  });
});

describe("acceptCardsAnswer", () => {
  it("drops an answer from an earlier attempt", () => {
    expect(acceptCardsAnswer(0, 1)).toBe(false);
    expect(acceptCardsAnswer(1, 1)).toBe(true);
  });
});

describe("pickCard", () => {
  it("keeps the remembered card while it is saved", () => {
    expect(pickCard([card("a"), card("b")], "b")).toBe("b");
  });
  it("falls back to the first card, or none, when the remembered one is gone", () => {
    expect(pickCard([card("a")], "gone")).toBe("a");
    expect(pickCard([], "gone")).toBeNull();
  });
  it("picks nothing while the list is unknown", () => {
    expect(pickCard(null, "a")).toBeNull();
  });
});

describe("methodsWaitOnCards", () => {
  const base = { cardOk: true, method: null, creditCovers: false } as const;
  it("waits while cards load or failed and nothing is picked", () => {
    expect(methodsWaitOnCards({ ...base, load: { state: "loading" } })).toBe(true);
    expect(methodsWaitOnCards({ ...base, load: { state: "failed" } })).toBe(true);
  });
  it("does not wait once the guest picks a method, the list is known, credit covers, or the place takes no cards", () => {
    expect(methodsWaitOnCards({ ...base, method: "cash", load: { state: "failed" } })).toBe(false);
    expect(methodsWaitOnCards({ ...base, load: { state: "loaded", cards: [] } })).toBe(false);
    expect(methodsWaitOnCards({ ...base, creditCovers: true, load: { state: "loading" } })).toBe(false);
    expect(methodsWaitOnCards({ ...base, cardOk: false, load: { state: "loading" } })).toBe(false);
  });
});

describe("fixedMethod", () => {
  it("keeps the method shown when the guest leaves Methods", () => {
    // Cash was shown while the cards loaded; a late card list must not win.
    expect(fixedMethod(null, "cash")).toBe("cash");
    expect(fixedMethod("card", "cash")).toBe("card");
    expect(fixedMethod(null, null)).toBeNull();
  });
});
