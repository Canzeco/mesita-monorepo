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
  bonusPctFor,
  CONTROLS_FALLBACK,
  CREDIT_PLACES,
  DAY_MS,
  daysUntilExpiry,
  expiryDaysFor,
  formatExpiry,
  formatUnlock,
  holdHoursFor,
  HOUR_MS,
  hoursUntil,
  isExpired,
  isLocked,
  spendableCents,
} from "@/lib/mock/credits-mock";
import { rankBalances } from "@/components/consumer/credits/BalanceStack";

// The console-owned terms every rule below resolves against. A place's own
// bonusPct/lockHours are null unless it set them, and what null MEANS is this.
const POLICY = CONTROLS_FALLBACK;

// One place that inherits both terms (what every place does today) and one
// that overrides both (so the ladder is exercised at all).
const INHERITS = CREDIT_PLACES[0];
const OVERRIDES = CREDIT_PLACES[3];

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

  // The fixture holds REAL public.places rows now, so this can only assert
  // against the longest name the catalog actually has (26, "Tony's Tacos Valle
  // Oriente"). The point is unchanged: the seed must contain a name that
  // overflows the peek strip, so truncation shows up in review rather than in
  // production. Raise this if a longer place is ever swapped in; never lower
  // it to make a shorter fixture pass.
  it("carries a name long enough to prove truncation in review", () => {
    const longest = Math.max(
      ...seeded().balances.map((b) => b.placeName.length),
    );
    expect(longest).toBeGreaterThanOrEqual(24);
  });

  it("carries card art, so the photo face is the one under test", () => {
    expect(seeded().balances.every((b) => !!b.photoUrl)).toBe(true);
  });
});

describe("the bonus ladder", () => {
  // The shape is the model: a place pays more for holding the money longer.
  // Resolved through the policy, because both terms are null on any place that
  // has not set them and the console decides what null is worth.
  it("pays more the longer the hold", () => {
    const byHold = [...CREDIT_PLACES].sort(
      (a, b) => holdHoursFor(a, POLICY) - holdHoursFor(b, POLICY),
    );
    for (let i = 1; i < byHold.length; i += 1) {
      expect(bonusPctFor(byHold[i], POLICY)).toBeGreaterThanOrEqual(
        bonusPctFor(byHold[i - 1], POLICY),
      );
    }
  });

  it("a place that set nothing inherits the console default", () => {
    expect(INHERITS.lockHours).toBeNull();
    expect(INHERITS.bonusPct).toBeNull();
    expect(holdHoursFor(INHERITS, POLICY)).toBe(POLICY.defaultHoldHours);
    expect(bonusPctFor(INHERITS, POLICY)).toBe(POLICY.defaultBonusPct);
  });

  it("a place that set its own terms keeps them", () => {
    expect(holdHoursFor(OVERRIDES, POLICY)).toBe(OVERRIDES.lockHours);
    expect(bonusPctFor(OVERRIDES, POLICY)).toBe(OVERRIDES.bonusPct);
  });

  it("the shipped default hold is three hours", () => {
    expect(POLICY.defaultHoldHours).toBe(3);
  });
});

describe("buy", () => {
  it("credits the bonus and holds for the place's own window", () => {
    const place = OVERRIDES;
    const r = buy(freshState(T0, "empty"), {
      placeId: place.id,
      paidCents: 100_000,
      nowMs: T0,
      balanceId: "bal_x",
      activityId: "act_x",
      policy: POLICY,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const b = r.value.balances[0];
    expect(b.balanceCents).toBe(
      100_000 + bonusFor(100_000, bonusPctFor(place, POLICY)),
    );
    expect(b.paidCents).toBe(100_000);
    expect(hoursUntil(b, T0)).toBeCloseTo(holdHoursFor(place, POLICY), 5);
    expect(spendableCents(b, T0)).toBe(0);
  });

  it("a place with no terms of its own is held for the console default", () => {
    const r = buy(freshState(T0, "empty"), {
      placeId: INHERITS.id,
      paidCents: 100_000,
      nowMs: T0,
      balanceId: "bal_y",
      activityId: "act_y",
      policy: POLICY,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(hoursUntil(r.value.balances[0], T0)).toBeCloseTo(3, 5);
  });

  it("a console change reprices the NEXT top-up, not one already bought", () => {
    const generous = {
      defaultHoldHours: 1,
      defaultBonusPct: 50,
      defaultExpiryDays: 365,
    };
    const before = buy(freshState(T0, "empty"), {
      placeId: INHERITS.id,
      paidCents: 100_000,
      nowMs: T0,
      balanceId: "b1",
      activityId: "a1",
      policy: POLICY,
    });
    if (!before.ok) return;
    // The stored balance keeps the terms it was bought under.
    expect(before.value.balances[0].bonusPct).toBe(POLICY.defaultBonusPct);
    const after = buy(before.value, {
      placeId: OVERRIDES.id,
      paidCents: 100_000,
      nowMs: T0,
      balanceId: "b2",
      activityId: "a2",
      policy: generous,
    });
    if (!after.ok) return;
    expect(after.value.balances[0].bonusPct).toBe(POLICY.defaultBonusPct);
  });

  it("carries the place's photo onto the balance for the card art", () => {
    const r = buy(freshState(T0, "empty"), {
      placeId: INHERITS.id,
      paidCents: 100_000,
      nowMs: T0,
      balanceId: "b",
      activityId: "a",
      policy: POLICY,
    });
    if (!r.ok) return;
    expect(r.value.balances[0].photoUrl).toBe(INHERITS.photoUrl);
  });

  it("rejects an unknown place and a non-positive amount", () => {
    const s = freshState(T0, "empty");
    const base = { nowMs: T0, balanceId: "b", activityId: "a", policy: POLICY };
    expect(buy(s, { ...base, placeId: "nope", paidCents: 1000 })).toEqual({
      ok: false,
      error: "unknown-place",
    });
    expect(buy(s, { ...base, placeId: INHERITS.id, paidCents: 0 })).toEqual({
      ok: false,
      error: "amount-not-positive",
    });
  });

  it("tops up an existing balance instead of opening a second one at one place", () => {
    let s = freshState(T0, "empty");
    const first = buy(s, {
      placeId: INHERITS.id,
      paidCents: 50_000,
      nowMs: T0,
      balanceId: "b1",
      activityId: "a1",
      policy: POLICY,
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    s = first.value;
    const second = buy(s, {
      placeId: INHERITS.id,
      paidCents: 50_000,
      nowMs: T0 + HOUR_MS,
      balanceId: "b2",
      activityId: "a2",
      policy: POLICY,
    });
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.value.balances).toHaveLength(1);
    expect(second.value.balances[0].paidCents).toBe(100_000);
  });

  it("RE-LOCKS on top-up — new money cannot hide behind a matured balance", () => {
    const place = INHERITS;
    let s = freshState(T0, "empty");
    const first = buy(s, {
      placeId: place.id,
      paidCents: 50_000,
      nowMs: T0,
      balanceId: "b1",
      activityId: "a1",
      policy: POLICY,
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
      policy: POLICY,
    });
    if (!second.ok) return;
    expect(isLocked(second.value.balances[0], later)).toBe(true);
    expect(hoursUntil(second.value.balances[0], later)).toBeCloseTo(
      holdHoursFor(place, POLICY),
      5,
    );
  });
});

describe("spend", () => {
  function matured(): CreditsState {
    const r = buy(freshState(T0, "empty"), {
      placeId: INHERITS.id,
      paidCents: 100_000,
      nowMs: T0,
      balanceId: "b1",
      activityId: "a1",
      policy: POLICY,
    });
    if (!r.ok) throw new Error("seed failed");
    return r.value;
  }
  // Inside the hold's shadow but well short of the 90-day expiry. It used to be
  // a year out, which is now a DEAD balance: a matured-and-spendable moment has
  // to sit between the two dates, and picking one that does not is the exact
  // mistake the expiry rule exists to catch.
  const AFTER = T0 + 7 * 24 * HOUR_MS;

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

describe("expiry", () => {
  // 90 days, in DAYS, is the shipped term. A test that reads the constant back
  // out of the fixture would pass against any number; this one is the pin.
  it("the shipped default expiry is 90 days", () => {
    expect(POLICY.defaultExpiryDays).toBe(90);
  });

  it("a place that set nothing inherits the console default", () => {
    expect(INHERITS.expiryDays).toBeNull();
    expect(expiryDaysFor(INHERITS, POLICY)).toBe(POLICY.defaultExpiryDays);
  });

  it("a place that sells a longer life keeps it", () => {
    expect(expiryDaysFor(OVERRIDES, POLICY)).toBe(OVERRIDES.expiryDays);
    expect(expiryDaysFor(OVERRIDES, POLICY)).toBeGreaterThan(
      POLICY.defaultExpiryDays,
    );
  });

  it("dates a top-up's expiry in DAYS from the purchase, not from maturity", () => {
    const r = buy(freshState(T0, "empty"), {
      placeId: OVERRIDES.id,
      paidCents: 100_000,
      nowMs: T0,
      balanceId: "b",
      activityId: "a",
      policy: POLICY,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const b = r.value.balances[0];
    // Exactly the override, off T0 — NOT off the 72h hold that place also sets.
    expect(b.expiresAtMs).toBe(T0 + OVERRIDES.expiryDays! * DAY_MS);
    expect(b.expiresAtMs).toBeGreaterThan(b.maturesAtMs);
  });

  it("every seeded balance matures before it expires", () => {
    // The degenerate state — money locked for its entire life — is what the
    // config's floor exists to prevent, so no fixture may ship in it.
    for (const b of seeded().balances) {
      expect(b.maturesAtMs).toBeLessThan(b.expiresAtMs);
    }
  });

  it("stops being spendable the moment it expires, without touching the balance", () => {
    const s = seeded();
    const b = s.balances[0];
    const justBefore = b.expiresAtMs - 1;
    const atExpiry = b.expiresAtMs;
    expect(isExpired(b, justBefore)).toBe(false);
    expect(spendableCents(b, justBefore)).toBe(b.balanceCents);
    expect(isExpired(b, atExpiry)).toBe(true);
    expect(spendableCents(b, atExpiry)).toBe(0);
    // The money is still ON the balance — expiry answers what can be spent,
    // not what happens to the remainder, which nothing has decided.
    expect(b.balanceCents).toBeGreaterThan(0);
  });

  it("refuses a spend on an expired balance, and says expired not short", () => {
    const s = seeded();
    const b = s.balances[0];
    expect(
      spend(s, {
        balanceId: b.id,
        amountCents: 999_999_999,
        nowMs: b.expiresAtMs + DAY_MS,
        activityId: "a",
      }),
    ).toEqual({ ok: false, error: "balance-expired" });
  });

  it("a top-up re-dates the whole balance, in the guest's favour", () => {
    let s = freshState(T0, "empty");
    const first = buy(s, {
      placeId: INHERITS.id,
      paidCents: 50_000,
      nowMs: T0,
      balanceId: "b1",
      activityId: "a1",
      policy: POLICY,
    });
    if (!first.ok) return;
    s = first.value;
    const later = T0 + 60 * 24 * HOUR_MS;
    const second = buy(s, {
      placeId: INHERITS.id,
      paidCents: 50_000,
      nowMs: later,
      balanceId: "b2",
      activityId: "a2",
      policy: POLICY,
    });
    if (!second.ok) return;
    const b = second.value.balances[0];
    expect(b.expiresAtMs).toBe(later + POLICY.defaultExpiryDays * DAY_MS);
    // The older money rode the new date up rather than dragging the new money
    // down to the old one.
    expect(b.expiresAtMs).toBeGreaterThan(
      first.value.balances[0].expiresAtMs,
    );
  });

  it("the demo clock kills a balance by moving time, not by touching it", () => {
    const s = seeded();
    const before = s.balances[0];
    const days = Math.ceil(daysUntilExpiry(before, T0));
    const advanced = advanceClock(s, (days + 1) * 24);
    const nowAfter = T0 + advanced.clockOffsetMs;
    const same = advanced.balances.find((b) => b.id === before.id)!;
    expect(same.expiresAtMs).toBe(before.expiresAtMs);
    expect(isExpired(same, nowAfter)).toBe(true);
    expect(spendableCents(same, nowAfter)).toBe(0);
  });
});

describe("deck order", () => {
  it("ranks spendable, then locked, then expired", () => {
    const s = seeded();
    const dead = s.balances[0].expiresAtMs + DAY_MS;
    // Far enough out that the seed's own locked card has matured, so the only
    // thing separating these is expiry.
    const ranked = rankBalances(s.balances, dead);
    const states = ranked.map((b) =>
      isExpired(b, dead) ? 2 : isLocked(b, dead) ? 1 : 0,
    );
    expect([...states].sort()).toEqual(states);
  });
});

describe("formatExpiry", () => {
  it("rounds DOWN — overstating an expiry costs a guest the money", () => {
    expect(formatExpiry(89.9)).toBe("89d");
    expect(formatExpiry(6)).toBe("6d");
  });

  it("names the last day rather than rounding it to nothing", () => {
    expect(formatExpiry(0.4)).toBe("Today");
  });

  it("says Expired once it has passed", () => {
    expect(formatExpiry(0)).toBe("Expired");
    expect(formatExpiry(-3)).toBe("Expired");
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
  const CONTAINER_SRC = ["src/app/(shell)/new-visit/wallet/CreditsClient.tsx"];

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
