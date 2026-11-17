import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { SavedCard } from "@/lib/api/cards";
import { readDraft, reopenGuestDraft, writeDraft } from "@/lib/guest-pay-draft";
import { initialStage, STEP, startAgainStage } from "@/lib/guest-pay-stages";
import { pickCard } from "@/lib/pay-cards";

// Money (MVP test rule), MESITA-4226: five steps, Method and Card merged into
// Pay. A draft saved at a retired step reopens at Pay (where the credits
// switch is), never past it; the card charged is the guest's one saved card.

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

describe("the five steps", () => {
  it("Bill · Tip · Pay · Sign · Receipt after Pick", () => {
    expect(STEP).toEqual({ pick: 0, bill: 1, tip: 2, pay: 3, sign: 4, receipt: 5 });
  });
});

describe("initialStage", () => {
  it("a draft at Pay starts at Pay; none starts at Bill", () => {
    expect(initialStage({ stage: "pay" })).toBe("pay");
    expect(initialStage({ stage: "bill" })).toBe("bill");
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

  it("reads a draft saved at the retired Method or Card as Pay, keeping its card", () => {
    for (const old of ["method", "card"]) {
      writeDraft("p", { stage: old as never, typing: false, amount: "100", tip: 10, other: "", useCredit: true, method: "card", cardId: "pm_a" });
      const d = readDraft("p");
      expect(d?.stage).toBe("pay");
      expect(d?.cardId).toBe("pm_a");
    }
  });
});

describe("startAgainStage (MESITA-4121, MESITA-4226)", () => {
  it("a failed card, an expired or a rejected bill starts again at Pay", () => {
    for (const r of ["bank_check_failed", "capture_failed", "hold_released", "expired", "rejected"]) {
      expect(startAgainStage({ endReason: r, cardFailed: true })).toBe("pay");
    }
    expect(startAgainStage({ endReason: null, cardFailed: true })).toBe("pay");
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
  it("after an expired bill: Pay, nothing marked refused", () => {
    writeDraft("p", sent);
    reopenGuestDraft("p", "pay");
    expect(readDraft("p")?.refusedCardId ?? null).toBeNull();
  });
  it("no draft (older than 30 minutes): nothing to reopen, the bill opens empty", () => {
    reopenGuestDraft("p", "pay", true);
    expect(readDraft("p")).toBeNull();
  });
});
