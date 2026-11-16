import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SavedCard } from "@/lib/api/cards";
import { readDraft, writeDraft } from "@/lib/guest-pay-draft";
import { guardStage, initialStage, payBackStage, payNextStage, STEP, skippedFromParts, skippedSegments } from "@/lib/guest-pay-stages";
import { pickCard } from "@/lib/pay-cards";

// Money (MVP test rule), MESITA-4117: the card charged is the card the guest
// saw on Card; a reload never turns a card choice into a cash give, never
// spends credits the guest switched off, and a just-refused card is never
// the default again.

const card = (id: string): SavedCard => ({ id, brand: "visa", last4: "4242", exp_month: 8, exp_year: 2029, in_use: false });

describe("guardStage", () => {
  const base = { method: "card" as const, way: "card" as const, dueCents: 9700, cardMissing: false };

  it("keeps Card and Pay on the card way with something to pay", () => {
    expect(guardStage({ ...base, stage: "card" })).toBe("card");
    expect(guardStage({ ...base, stage: "pay" })).toBe("pay");
  });

  it("sends Card to Method for cash or when credits cover everything", () => {
    expect(guardStage({ ...base, stage: "card", way: "cash" })).toBe("method");
    expect(guardStage({ ...base, stage: "card", dueCents: 0 })).toBe("method");
  });

  it("never turns a card choice into the cash screen", () => {
    // A reload where the card minimum now rules the card out: way is cash.
    expect(guardStage({ ...base, stage: "pay", way: "cash" })).toBe("method");
    expect(guardStage({ ...base, stage: "pay", way: null })).toBe("method");
  });

  it("never stops at Pay when credits cover everything", () => {
    expect(guardStage({ ...base, stage: "pay", dueCents: 0 })).toBe("method");
  });

  it("sends a card Pay with no chargeable card to Card", () => {
    expect(guardStage({ ...base, stage: "pay", cardMissing: true })).toBe("card");
  });

  it("leaves Bill and Method alone", () => {
    expect(guardStage({ ...base, stage: "bill", way: null })).toBe("bill");
    expect(guardStage({ ...base, stage: "method", way: null, dueCents: 0 })).toBe("method");
  });
});

describe("next and back", () => {
  it("cash never stops at Card, either way", () => {
    expect(payNextStage("cash")).toBe("pay");
    expect(payBackStage("pay", "cash")).toBe("method");
  });

  it("the card way walks Method → Card → Pay and back", () => {
    expect(payNextStage("card")).toBe("card");
    expect(payBackStage("pay", "card")).toBe("card");
    expect(payBackStage("card", "card")).toBe("method");
    expect(payBackStage("method", "card")).toBe("bill");
  });
});

describe("skipped segments", () => {
  it("Card for cash, Card and Pay for credits only, none before the way", () => {
    expect(skippedSegments({ way: "cash", creditsOnly: false })).toEqual([STEP.card]);
    expect(skippedSegments({ way: "card", creditsOnly: true })).toEqual([STEP.card, STEP.pay]);
    expect(skippedSegments({ way: null, creditsOnly: false })).toEqual([]);
  });

  it("Sign reads the same skips from the bill's parts", () => {
    expect(skippedFromParts([{ part: "credit" }, { part: "card" }])).toEqual([]);
    expect(skippedFromParts([{ part: "cash" }])).toEqual([STEP.card]);
    expect(skippedFromParts([{ part: "credit" }])).toEqual([STEP.card, STEP.pay]);
  });
});

describe("initialStage", () => {
  it("a draft at Card or Pay with credits off starts at Method", () => {
    expect(initialStage({ stage: "card", useCredit: false })).toBe("method");
    expect(initialStage({ stage: "pay", useCredit: false })).toBe("method");
  });
  it("otherwise the draft's stage, or Bill with none", () => {
    expect(initialStage({ stage: "card", useCredit: true })).toBe("card");
    expect(initialStage(null)).toBe("bill");
  });
});

describe("pickCard never defaults to a refused card", () => {
  const cards = [card("a"), card("b")];
  it("skips the refused card when nothing is remembered", () => {
    expect(pickCard(cards, null, "a")).toBe("b");
  });
  it("skips the refused card when it was the remembered one", () => {
    expect(pickCard(cards, "a", "a")).toBe("b");
  });
  it("picks nothing when the only card was refused", () => {
    expect(pickCard([card("a")], null, "a")).toBeNull();
  });
  it("keeps the remembered card otherwise", () => {
    expect(pickCard(cards, "b", "a")).toBe("b");
    expect(pickCard(cards, "a", null)).toBe("a");
  });
});

describe("readDraft never trusts a stored stage", () => {
  function memoryStorage(): Storage {
    const m = new Map<string, string>();
    return {
      get length() {
        return m.size;
      },
      clear: () => m.clear(),
      getItem: (k) => m.get(k) ?? null,
      key: (i) => [...m.keys()][i] ?? null,
      removeItem: (k) => void m.delete(k),
      setItem: (k, v) => void m.set(k, String(v)),
    };
  }
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: memoryStorage() };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("reads an unknown stage as Bill and junk method or card ids as none", () => {
    writeDraft("p", {
      stage: "review" as never,
      typing: false,
      amount: "100",
      tip: 10,
      other: "",
      useCredit: true,
      method: "bitcoin" as never,
      cardId: 42 as never,
      refusedCardId: "pm_x",
    });
    const d = readDraft("p");
    expect(d?.stage).toBe("bill");
    expect(d?.method).toBeNull();
    expect(d?.cardId).toBeNull();
    expect(d?.refusedCardId).toBe("pm_x");
  });

  it("keeps a valid Card stage and its card", () => {
    writeDraft("p", { stage: "card", typing: false, amount: "100", tip: 10, other: "", useCredit: true, method: "card", cardId: "pm_a" });
    const d = readDraft("p");
    expect(d?.stage).toBe("card");
    expect(d?.cardId).toBe("pm_a");
  });
});
