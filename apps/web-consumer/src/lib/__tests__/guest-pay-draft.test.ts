import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PAY_DRAFT_MAX_AGE_MS,
  clearGuestDraft,
  outcomeUnknownAfter,
  payDraftExpired,
  pendingTicketPlace,
  readDraft,
  readLastCard,
  requestIdAfterEdit,
  writeDraft,
  writeLastCard,
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
  amount,
  tip: 10 as const,
  other: "",
  useCredit: true,
});

describe("clearGuestDraft", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: memoryStorage() };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
  });

  it("clears this place's draft; a typed bill is never a pending ticket (MESITA-4524)", () => {
    writeDraft("place-a", typed("250"));
    expect(pendingTicketPlace()).toBeNull();
    clearGuestDraft("place-a");
    expect(readDraft("place-a")).toBeNull();
  });

  it("remembers the last card (a voucher's default), and drops a blank id", () => {
    expect(readLastCard()).toBeNull();
    writeLastCard("pm_1");
    expect(readLastCard()).toBe("pm_1");
    writeLastCard(null);
    expect(readLastCard()).toBe("pm_1");
    writeLastCard("");
    expect(readLastCard()).toBe("pm_1");
  });

  it("keeps another place's draft", () => {
    writeDraft("place-a", typed("250"));
    writeDraft("place-b", typed("90"));
    clearGuestDraft("place-a");
    expect(readDraft("place-a")).toBeNull();
    expect(readDraft("place-b")?.amount).toBe("90");
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

// Money (MVP test rule): a stale draft must not come back as a payment half
// made (MESITA-3759; the limit moved here with MESITA-4305).
describe("the draft limit", () => {
  it("is thirty minutes; exactly at the limit is still good", () => {
    const now = 1_800_000_000_000;
    expect(PAY_DRAFT_MAX_AGE_MS).toBe(30 * 60 * 1000);
    expect(payDraftExpired(now - PAY_DRAFT_MAX_AGE_MS, now)).toBe(false);
    expect(payDraftExpired(now - PAY_DRAFT_MAX_AGE_MS - 1, now)).toBe(true);
  });
});
