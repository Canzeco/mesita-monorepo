import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseCreditsDemo } from "@/lib/credits-demo";
import {
  advanceClock,
  buy,
  freshState,
  spend,
  type CreditsState,
} from "@/lib/mock/credits-emulator";
import {
  bonusFor,
  CREDIT_PLACES,
  formatUnlock,
  HOUR_MS,
  hoursUntil,
  isLocked,
  placeById,
  spendableCents,
} from "@/lib/mock/credits-mock";

// Guards for the /credits emulator (MESITA-1380).
//
// The whole ruleset is pure functions taking an explicit nowMs and explicit
// ids, so every rule below is tested without faking globals or a clock.
//
// What is NOT covered, and cannot be in this harness: the spread state and both
// LocalSheets. vitest runs environment:"node" with renderToStaticMarkup, so
// effects never run — and LocalOverlay's CardPortal returns null when
// #mesita-app-card is absent, which is every test. Those are eyeballed on the
// Vercel preview. Do not read this file as covering them.

const T0 = 1_700_000_000_000;

function seeded(): CreditsState {
  return freshState(T0, "default");
}

describe("parseCreditsDemo", () => {
  it("defaults to the seeded stack", () => {
    expect(parseCreditsDemo({})).toBe("default");
    expect(parseCreditsDemo({ demo: "nonsense" })).toBe("default");
  });

  it("reads empty, and takes the first value when Next hands it an array", () => {
    expect(parseCreditsDemo({ demo: "empty" })).toBe("empty");
    expect(parseCreditsDemo({ demo: ["empty", "default"] })).toBe("empty");
  });
});

describe("seed", () => {
  it("opens with something matured and something still locked", () => {
    const s = seeded();
    expect(s.balances.some((b) => isLocked(b, T0))).toBe(true);
    expect(s.balances.some((b) => !isLocked(b, T0))).toBe(true);
  });

  it("empty is empty", () => {
    expect(freshState(T0, "empty").balances).toEqual([]);
  });

  it("carries a name long enough to prove truncation in review", () => {
    const longest = Math.max(
      ...seeded().balances.map((b) => b.placeName.length),
    );
    expect(longest).toBeGreaterThanOrEqual(30);
  });
});

describe("the bonus ladder", () => {
  // The shape is the model: a place pays more for holding the money longer.
  it("pays more the longer the lock", () => {
    const byLock = [...CREDIT_PLACES].sort((a, b) => a.lockHours - b.lockHours);
    for (let i = 1; i < byLock.length; i += 1) {
      expect(byLock[i].bonusPct).toBeGreaterThanOrEqual(byLock[i - 1].bonusPct);
    }
  });
});

describe("buy", () => {
  it("credits the bonus and locks for the place's own window", () => {
    const place = placeById("plc_pangea")!;
    const r = buy(freshState(T0, "empty"), {
      placeId: place.id,
      paidCents: 100_000,
      nowMs: T0,
      balanceId: "bal_x",
      activityId: "act_x",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const b = r.value.balances[0];
    expect(b.balanceCents).toBe(100_000 + bonusFor(100_000, place.bonusPct));
    expect(b.paidCents).toBe(100_000);
    expect(hoursUntil(b, T0)).toBeCloseTo(place.lockHours, 5);
    expect(spendableCents(b, T0)).toBe(0);
  });

  it("rejects an unknown place and a non-positive amount", () => {
    const s = freshState(T0, "empty");
    const base = { nowMs: T0, balanceId: "b", activityId: "a" };
    expect(buy(s, { ...base, placeId: "nope", paidCents: 1000 })).toEqual({
      ok: false,
      error: "unknown-place",
    });
    expect(buy(s, { ...base, placeId: "plc_lardo", paidCents: 0 })).toEqual({
      ok: false,
      error: "amount-not-positive",
    });
  });

  it("tops up an existing balance instead of opening a second one at one place", () => {
    let s = freshState(T0, "empty");
    const first = buy(s, {
      placeId: "plc_lardo",
      paidCents: 50_000,
      nowMs: T0,
      balanceId: "b1",
      activityId: "a1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    s = first.value;
    const second = buy(s, {
      placeId: "plc_lardo",
      paidCents: 50_000,
      nowMs: T0 + HOUR_MS,
      balanceId: "b2",
      activityId: "a2",
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.balances).toHaveLength(1);
    expect(second.value.balances[0].paidCents).toBe(100_000);
  });

  it("RE-LOCKS on top-up — new money cannot hide behind a matured balance", () => {
    const place = placeById("plc_lardo")!;
    let s = freshState(T0, "empty");
    const first = buy(s, {
      placeId: place.id,
      paidCents: 50_000,
      nowMs: T0,
      balanceId: "b1",
      activityId: "a1",
    });
    if (!first.ok) return;
    s = first.value;
    // Long after the first lock lifted.
    const later = T0 + 30 * 24 * HOUR_MS;
    expect(isLocked(s.balances[0], later)).toBe(false);
    const second = buy(s, {
      placeId: place.id,
      paidCents: 50_000,
      nowMs: later,
      balanceId: "b2",
      activityId: "a2",
    });
    if (!second.ok) return;
    expect(isLocked(second.value.balances[0], later)).toBe(true);
    expect(hoursUntil(second.value.balances[0], later)).toBeCloseTo(
      place.lockHours,
      5,
    );
  });
});

describe("spend", () => {
  function matured(): CreditsState {
    const r = buy(freshState(T0, "empty"), {
      placeId: "plc_cafe",
      paidCents: 100_000,
      nowMs: T0,
      balanceId: "b1",
      activityId: "a1",
    });
    if (!r.ok) throw new Error("seed failed");
    return r.value;
  }
  const AFTER = T0 + 365 * 24 * HOUR_MS;

  it("draws the balance down and records it", () => {
    const s = matured();
    const before = s.balances[0].balanceCents;
    const r = spend(s, {
      balanceId: "b1",
      amountCents: 30_000,
      nowMs: AFTER,
      activityId: "a2",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.balances[0].balanceCents).toBe(before - 30_000);
    expect(r.value.balances[0].activity[0].amountCents).toBe(-30_000);
  });

  it("refuses a locked balance — the lock is the product, not a hint", () => {
    const r = spend(matured(), {
      balanceId: "b1",
      amountCents: 1000,
      nowMs: T0,
      activityId: "a2",
    });
    expect(r).toEqual({ ok: false, error: "balance-locked" });
  });

  it("refuses more than is there, and refuses a non-positive amount", () => {
    const s = matured();
    expect(
      spend(s, {
        balanceId: "b1",
        amountCents: 999_999_999,
        nowMs: AFTER,
        activityId: "a",
      }),
    ).toEqual({ ok: false, error: "insufficient-credits" });
    expect(
      spend(s, {
        balanceId: "b1",
        amountCents: 0,
        nowMs: AFTER,
        activityId: "a",
      }),
    ).toEqual({ ok: false, error: "amount-not-positive" });
  });

  it("refuses an unknown balance", () => {
    expect(
      spend(matured(), {
        balanceId: "nope",
        amountCents: 100,
        nowMs: AFTER,
        activityId: "a",
      }),
    ).toEqual({ ok: false, error: "unknown-balance" });
  });
});

describe("the demo clock", () => {
  it("matures a locked balance by moving time, not by touching the balance", () => {
    const s = seeded();
    const locked = s.balances.find((b) => isLocked(b, T0))!;
    const hours = Math.ceil(hoursUntil(locked, T0));
    const advanced = advanceClock(s, hours + 1);
    const nowAfter = T0 + advanced.clockOffsetMs;
    const same = advanced.balances.find((b) => b.id === locked.id)!;
    expect(same.maturesAtMs).toBe(locked.maturesAtMs);
    expect(isLocked(same, nowAfter)).toBe(false);
    expect(spendableCents(same, nowAfter)).toBe(same.balanceCents);
  });
});

describe("formatUnlock", () => {
  it("shows hours under a day and days beyond it", () => {
    expect(formatUnlock(18)).toBe("18h");
    expect(formatUnlock(24)).toBe("1d");
    expect(formatUnlock(144)).toBe("6d");
  });

  it("never renders a zero — a lock that short is still a lock", () => {
    expect(formatUnlock(0.2)).toBe("1h");
  });
});

// This guard used to say "wallet is spent twice over — Cards is the saved-card
// wallet and Credits is the other", and banned the word outright. That premise
// retired on 2026-08-31: there is now ONE Wallet, the first Activity section,
// and it holds the cards, the Credits and Gift together.
//
// What survives is the half that still bites. The MONEY files must never name
// a balance after the container — an instrument called WalletBalance is the
// drift this catches, and the instrument is Credits. CreditsClient is exempt
// from that half alone, because it renders the container and legitimately
// names a row type after it. Prepay* stays banned everywhere: a prepay is how
// you acquire Credits, never what you hold. The lucide `Wallet` glyph stays
// importable throughout — it never matched, needing a capital after it.
describe("naming", () => {
  const MONEY_SRC = [
    "src/components/consumer/credits/BalanceCard.tsx",
    "src/components/consumer/credits/BalanceStack.tsx",
    "src/components/consumer/credits/BalanceDetail.tsx",
    "src/components/consumer/credits/BuyCreditsSheet.tsx",
    "src/lib/mock/credits-mock.ts",
    "src/lib/mock/credits-emulator.ts",
  ];
  const CONTAINER_SRC = ["src/app/(shell)/inbox/credits/CreditsClient.tsx"];

  function read(rel: string): string {
    return readFileSync(join(__dirname, "..", "..", "..", rel), "utf8");
  }

  it.each(MONEY_SRC)("%s declares no Wallet* identifier", (rel) => {
    expect(read(rel).match(/\bWallet[A-Z]\w*/g) ?? []).toEqual([]);
  });

  it.each([...MONEY_SRC, ...CONTAINER_SRC])(
    "%s declares no Prepay* identifier",
    (rel) => {
      expect(read(rel).match(/\bPrepay[A-Z]\w*/g) ?? []).toEqual([]);
    },
  );
});
