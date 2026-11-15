import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearGuestDraft,
  outcomeUnknownAfter,
  pendingTicketPlace,
  readDraft,
  requestIdAfterEdit,
  writeDraft,
} from "@/lib/guest-pay-draft";

// Cancel bill throws a ticket away (data loss is the point; leaving a ghost
// pointer would block every other place with "Finish this bill first"), and
// a timed-out Pay must never get a second request id (money): MESITA-4061.

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

const typed = (amount: string) => ({
  stage: "bill" as const,
  typing: false,
  amount,
  tip: 10 as const,
  other: "",
  useCredit: true,
  method: null,
  cardId: null,
});

describe("clearGuestDraft", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: memoryStorage() };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("removes this place's draft and its pending pointer", () => {
    writeDraft("place-a", typed("250"));
    expect(pendingTicketPlace()).toBe("place-a");
    clearGuestDraft("place-a");
    expect(readDraft("place-a")).toBeNull();
    expect(pendingTicketPlace()).toBeNull();
  });

  it("counts a typed 0 as a ticket, and clears it", () => {
    writeDraft("place-a", typed("0."));
    expect(pendingTicketPlace()).toBe("place-a");
    clearGuestDraft("place-a");
    expect(pendingTicketPlace()).toBeNull();
  });

  it("keeps another place's pointer", () => {
    writeDraft("place-a", typed("250"));
    writeDraft("place-b", typed("90"));
    clearGuestDraft("place-a");
    expect(readDraft("place-a")).toBeNull();
    expect(pendingTicketPlace()).toBe("place-b");
  });
});

describe("one payment per tap", () => {
  it("a timeout or a lost connection leaves the outcome unknown; a refusal does not", () => {
    expect(outcomeUnknownAfter(null)).toBe(true);
    expect(outcomeUnknownAfter("card_declined")).toBe(false);
  });

  it("keeps the request id while the outcome is unknown, and drops it after an edit otherwise", () => {
    expect(requestIdAfterEdit("req-1", true)).toBe("req-1");
    expect(requestIdAfterEdit("req-1", false)).toBeNull();
  });
});
