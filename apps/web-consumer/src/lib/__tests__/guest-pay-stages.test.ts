import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SavedCard } from "@/lib/api/cards";
import { readDraft, reopenGuestDraft, writeDraft } from "@/lib/guest-pay-draft";
import { guardStage, initialStage, payBackStage, STEP, startAgainStage } from "@/lib/guest-pay-stages";
import { pickCard } from "@/lib/pay-cards";

// Money (MVP test rule), MESITA-4226: no Card step (one saved card per
// guest). A reload never turns a card choice into a cash give, never spends
// credits the guest switched off, and a draft saved at the retired Card step
// reopens at Pay with its card.

const card = (id: string): SavedCard => ({ id, brand: "visa", last4: "4242", exp_month: 8, exp_year: 2029, in_use: false });

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

describe("the steps", () => {
  it("Pick · Bill · Tip · Method · Pay · Confirm · Receipt", () => {
    expect(STEP).toEqual({ pick: 0, bill: 1, tip: 2, method: 3, pay: 4, sign: 5, receipt: 6 });
  });
});

describe("guardStage", () => {
  const base = { method: "card" as const, way: "card" as const, dueCents: 9700 };

  it("keeps Pay on the guest's way with something to pay", () => {
    expect(guardStage({ ...base, stage: "pay" })).toBe("pay");
    expect(guardStage({ ...base, stage: "pay", method: "cash", way: "cash" })).toBe("pay");
  });

  it("never turns a card choice into the cash screen", () => {
    // A reload where the card minimum now rules the card out: way is cash.
    expect(guardStage({ ...base, stage: "pay", way: "cash" })).toBe("method");
    expect(guardStage({ ...base, stage: "pay", way: null })).toBe("method");
  });

  it("never stops at Pay when credits cover everything", () => {
    expect(guardStage({ ...base, stage: "pay", dueCents: 0 })).toBe("method");
  });

  it("leaves Bill and Method alone", () => {
    expect(guardStage({ ...base, stage: "bill", way: null })).toBe("bill");
    expect(guardStage({ ...base, stage: "method", way: null, dueCents: 0 })).toBe("method");
  });
});

describe("back", () => {
  it("Pay → Method → Tip", () => {
    expect(payBackStage("pay")).toBe("method");
    expect(payBackStage("method")).toBe("bill");
  });
});

describe("initialStage", () => {
  it("a draft at Pay with credits off starts at Method", () => {
    expect(initialStage({ stage: "pay", useCredit: false })).toBe("method");
  });
  it("otherwise the draft's stage, or Bill with none", () => {
    expect(initialStage({ stage: "pay", useCredit: true })).toBe("pay");
    expect(initialStage({ stage: "method", useCredit: false })).toBe("method");
    expect(initialStage(null)).toBe("bill");
  });
});

describe("pickCard", () => {
  it("the remembered card if still saved, else the first, else none", () => {
    expect(pickCard([card("a")], "a")).toBe("a");
    expect(pickCard([card("b")], "a")).toBe("b");
    expect(pickCard([], "a")).toBeNull();
    expect(pickCard(null, "a")).toBeNull();
  });
});

describe("readDraft never trusts a stored stage", () => {
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

  it("reads a draft saved at the retired Card step as Pay, keeping its card", () => {
    writeDraft("p", { stage: "card" as never, typing: false, amount: "100", tip: 10, other: "", useCredit: true, method: "card", cardId: "pm_a" });
    const d = readDraft("p");
    expect(d?.stage).toBe("pay");
    expect(d?.cardId).toBe("pm_a");
  });
});

describe("startAgainStage (MESITA-4121, MESITA-4226)", () => {
  it("a failed card part starts again at Pay", () => {
    for (const r of ["bank_check_failed", "capture_failed", "hold_released"]) {
      expect(startAgainStage({ endReason: r, cardFailed: true })).toBe("pay");
    }
    expect(startAgainStage({ endReason: null, cardFailed: true })).toBe("pay");
  });
  it("an expired or rejected bill starts again at Method", () => {
    expect(startAgainStage({ endReason: "expired", cardFailed: false })).toBe("method");
    expect(startAgainStage({ endReason: "rejected", cardFailed: true })).toBe("method");
  });
  it("anything else starts again at Bill", () => {
    expect(startAgainStage({ endReason: "cancelled", cardFailed: false })).toBe("bill");
    expect(startAgainStage({ endReason: null, cardFailed: false })).toBe("bill");
  });
});

describe("reopenGuestDraft (MESITA-4121)", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: memoryStorage() };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });
  const sent = { stage: "bill" as const, typing: false, amount: "100", tip: 10 as const, other: "", useCredit: true, method: "card" as const, cardId: "pm_a", sentTabId: "t1" };

  it("after a failed card: Pay, the same card kept and marked refused, the sent bill cleared", () => {
    writeDraft("p", sent);
    reopenGuestDraft("p", "pay", true);
    const d = readDraft("p");
    expect(d?.stage).toBe("pay");
    expect(d?.cardId).toBe("pm_a");
    expect(d?.refusedCardId).toBe("pm_a");
    expect(d?.sentTabId ?? null).toBeNull();
  });
  it("after an expired bill: Method, nothing marked refused", () => {
    writeDraft("p", sent);
    reopenGuestDraft("p", "method");
    expect(readDraft("p")?.stage).toBe("method");
    expect(readDraft("p")?.refusedCardId ?? null).toBeNull();
  });
  it("no draft (older than 30 minutes): nothing to reopen, the bill opens empty", () => {
    reopenGuestDraft("p", "pay", true);
    expect(readDraft("p")).toBeNull();
  });
});
