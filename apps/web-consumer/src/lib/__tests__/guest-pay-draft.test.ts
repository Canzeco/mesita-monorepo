import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readLastCard, writeLastCard } from "@/lib/guest-pay-draft";

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

describe("the last card", () => {
  beforeEach(() => {
    (globalThis as { window?: unknown }).window = { localStorage: memoryStorage() };
  });
  afterEach(() => {
    delete (globalThis as { window?: unknown }).window;
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
});
