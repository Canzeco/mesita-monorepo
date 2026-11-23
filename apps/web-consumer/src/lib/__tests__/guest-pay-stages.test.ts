import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pendingTicket, readDraft, reopenGuestDraft, writeDraft } from "@/lib/guest-pay-draft";
import { closeAction, guardStage, initialStage, payBackStage, STEP } from "@/lib/guest-pay-stages";

// Money (MVP test rule): a reload never shows Pay with nothing to pay or a
// way the guest did not choose, never spends credits the guest switched off,
// and a draft saved at the retired Card step (MESITA-4226) reopens at Pay.
// MESITA-4708: a bill has no card way; a stored card method reads as none.

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
  const base = { method: "cash" as const, way: "cash" as const, dueCents: 9700 };

  it("keeps Pay on the guest's way with something to pay", () => {
    expect(guardStage({ ...base, stage: "pay" })).toBe("pay");
    expect(guardStage({ ...base, stage: "pay", method: null })).toBe("pay");
  });

  it("never stops at Pay when the place takes no way for the rest", () => {
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

describe("readDraft never trusts a stored stage", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: memoryStorage() };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("reads an unknown stage as Bill and a junk or card method as none", () => {
    writeDraft("p", { stage: "review" as never, typing: false, amount: "100", tip: 10, other: "", useCredit: true, method: "bitcoin" as never });
    const d = readDraft("p");
    expect(d?.stage).toBe("bill");
    expect(d?.method).toBeNull();
    writeDraft("p", { stage: "pay", typing: false, amount: "100", tip: 10, other: "", useCredit: true, method: "card" as never });
    expect(readDraft("p")?.method).toBeNull();
  });

  it("reads a draft saved at the retired Card step as Pay", () => {
    writeDraft("p", { stage: "card" as never, typing: false, amount: "100", tip: 10, other: "", useCredit: true, method: "cash" });
    expect(readDraft("p")?.stage).toBe("pay");
  });
});

describe("reopenGuestDraft (MESITA-4121)", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: memoryStorage() };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });
  const sent = { stage: "bill" as const, typing: false, amount: "100", tip: 10 as const, other: "", useCredit: true, method: "cash" as const, sentTabId: "t1" };

  it("back to Method: what was typed stays, keypad down, the sent bill cleared", () => {
    writeDraft("p", sent);
    reopenGuestDraft("p", "method");
    const d = readDraft("p");
    expect(d?.stage).toBe("method");
    expect([d?.amount, d?.typing]).toEqual(["100", false]);
    expect(d?.sentTabId ?? null).toBeNull();
  });
  it("no draft (older than 30 minutes): nothing to reopen, the bill opens empty", () => {
    reopenGuestDraft("p", "pay");
    expect(readDraft("p")).toBeNull();
  });
});

describe("no zombie tickets (MESITA-4524)", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: memoryStorage() };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("a typed bill lives in memory only: never in localStorage, never a pending ticket", () => {
    writeDraft("p", { stage: "pay", typing: false, amount: "100", tip: 10, other: "", useCredit: true, method: "cash" });
    expect(readDraft("p")?.amount).toBe("100");
    const ls = (globalThis as unknown as { window: { localStorage: Storage } }).window.localStorage;
    expect(ls.length).toBe(0);
    expect(pendingTicket()).toBeNull();
  });
});

// Data loss (MVP test rule), MESITA-4600: the ✕ never throws away a bill
// that may already be open on the server, and never acts mid-call.
describe("closeAction", () => {
  it("does nothing while a pay call runs", () => {
    expect(closeAction({ busy: true, billOpen: true })).toBe("ignore");
    expect(closeAction({ busy: true, billOpen: false })).toBe("ignore");
  });
  it("leaves and keeps a bill that may be open", () => {
    expect(closeAction({ busy: false, billOpen: true })).toBe("leave-keep");
  });
  it("discards a ticket nothing has paid yet", () => {
    expect(closeAction({ busy: false, billOpen: false })).toBe("discard");
  });
});

