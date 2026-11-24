import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { pendingTicket, readDraft, reopenGuestDraft, writeDraft } from "@/lib/guest-pay-draft";
import { closeAction } from "@/lib/guest-pay-stages";

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

describe("reopenGuestDraft (MESITA-4121)", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: memoryStorage() };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });
  const sent = { amount: "100", tip: 10 as const, other: "", useCredit: true, sentTabId: "t1" };

  it("back to Bill: what was typed stays, the sent bill cleared", () => {
    writeDraft("p", sent);
    reopenGuestDraft("p");
    const d = readDraft("p");
    expect(d?.amount).toBe("100");
    expect(d?.sentTabId ?? null).toBeNull();
  });
  it("no draft (older than 30 minutes): nothing to reopen, the bill opens empty", () => {
    reopenGuestDraft("p");
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
    writeDraft("p", { amount: "100", tip: 10, other: "", useCredit: true });
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

