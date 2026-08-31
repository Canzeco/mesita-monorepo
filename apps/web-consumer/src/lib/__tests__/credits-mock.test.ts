import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseCreditsDemo } from "@/lib/credits-demo";
import {
  formatUnlock,
  isLocked,
  mockBalances,
  spendableCents,
} from "@/lib/mock/credits-mock";

// Guards for the /credits spike (MESITA-1380).
//
// What is NOT covered, and cannot be in this harness: the spread state and
// BalanceDetail. vitest runs environment:"node" with renderToStaticMarkup, so
// effects never run — and LocalSheet's CardPortal returns null when
// #mesita-app-card is absent, which is every test. Those two are eyeballed on
// the Vercel preview. Do not read this file as covering them.

describe("parseCreditsDemo", () => {
  it("defaults to the stack — the question is how several of these feel", () => {
    expect(parseCreditsDemo({})).toBe("stack");
    expect(parseCreditsDemo({ demo: "nonsense" })).toBe("stack");
  });

  it("reads solo and empty", () => {
    expect(parseCreditsDemo({ demo: "solo" })).toBe("solo");
    expect(parseCreditsDemo({ demo: "empty" })).toBe("empty");
  });

  it("takes the first value when Next hands it an array", () => {
    expect(parseCreditsDemo({ demo: ["solo", "stack"] })).toBe("solo");
  });
});

describe("balance maths", () => {
  it("a locked balance is never spendable", () => {
    const locked = mockBalances("solo")[0];
    expect(isLocked(locked)).toBe(true);
    expect(spendableCents(locked)).toBe(0);
  });

  it("every balance pays a bonus — you always get more than you paid", () => {
    for (const b of mockBalances("stack")) {
      expect(b.balanceCents).toBeGreaterThan(b.paidCents);
    }
  });

  it("the solo fixture is the honest year-one case: one, locked, nothing spendable", () => {
    const solo = mockBalances("solo");
    expect(solo).toHaveLength(1);
    expect(solo.every(isLocked)).toBe(true);
    expect(solo.reduce((s, b) => s + spendableCents(b), 0)).toBe(0);
  });

  it("the stack carries a name long enough to prove truncation in review", () => {
    const longest = Math.max(
      ...mockBalances("stack").map((b) => b.placeName.length),
    );
    expect(longest).toBeGreaterThanOrEqual(30);
  });

  it("empty is empty", () => {
    expect(mockBalances("empty")).toEqual([]);
  });
});

describe("formatUnlock", () => {
  it("shows hours under a day and days beyond it", () => {
    expect(formatUnlock(18)).toBe("18h");
    expect(formatUnlock(23)).toBe("23h");
    expect(formatUnlock(24)).toBe("1d");
    expect(formatUnlock(144)).toBe("6d");
  });

  it("never renders a zero — a lock that short is still a lock", () => {
    expect(formatUnlock(0.2)).toBe("1h");
  });
});

// The word "wallet" is spent twice over in this codebase: Cards is the
// saved-card wallet and must never be called one in copy, and Credits is the
// other. Identifiers are what actually drift, so ban those — while leaving the
// lucide `Wallet` glyph importable, which the parked Credits row already uses.
describe("naming", () => {
  const SRC = [
    "src/components/consumer/credits/BalanceCard.tsx",
    "src/components/consumer/credits/BalanceStack.tsx",
    "src/components/consumer/credits/BalanceDetail.tsx",
    "src/app/(shell)/credits/CreditsClient.tsx",
    "src/lib/mock/credits-mock.ts",
  ];

  it.each(SRC)("%s declares no Wallet* or Prepay* identifier", (rel) => {
    const src = readFileSync(join(__dirname, "..", "..", "..", rel), "utf8");
    const offenders = src.match(/\b(Wallet|Prepay)[A-Z]\w*/g) ?? [];
    expect(offenders).toEqual([]);
  });
});
