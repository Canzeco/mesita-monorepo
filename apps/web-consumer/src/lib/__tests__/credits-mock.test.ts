import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { parseCreditsDemo } from "@/lib/credits-demo";
import {
  buy,
  freshState,
  gift,
  giftCode,
  redeem,
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
  HOUR_MS,
  isExpired,
  spendableCents,
} from "@/lib/mock/credits-mock";
import { rankBalances } from "@/components/consumer/credits/BalanceList";

// The console-owned terms every rule below resolves against. A place's own
// bonusPct/expiryDays are null unless it set them, and what null MEANS is this.
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
// What is NOT covered, and cannot be in this harness: the four full-screen
// Wallet routes. vitest runs environment:"node" with renderToStaticMarkup, so
// effects never run and `useCredits` never loads — every one of those screens
// renders its loading branch and nothing else. They are eyeballed on the Vercel
// preview. Do not read this file as covering them.
//
// It DOES cover the whole gift ruleset, because gifting is pure: `gift` and
// `redeem` take their code, their ids and their clock as arguments exactly as
// `buy` and `spend` do.

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
  // Buying is activation (2026-09-08), so there is no third state to seed and
  // no card that opens waiting for a clock nothing can move any more.
  it("opens with every balance spendable", () => {
    for (const b of seeded().balances) {
      expect(spendableCents(b, T0)).toBe(b.balanceCents);
    }
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

describe("the bonus", () => {
  it("a place that set nothing inherits the console default", () => {
    expect(INHERITS.bonusPct).toBeNull();
    expect(bonusPctFor(INHERITS, POLICY)).toBe(POLICY.defaultBonusPct);
  });

  it("a place that set its own keeps it", () => {
    expect(bonusPctFor(OVERRIDES, POLICY)).toBe(OVERRIDES.bonusPct);
  });

  it("the shipped default bonus is five percent", () => {
    expect(POLICY.defaultBonusPct).toBe(5);
  });
});

describe("buy", () => {
  it("credits the bonus and is spendable the same instant", () => {
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
    // THE RULE (Pato, 2026-09-08). Not "spendable soon", not "spendable after
    // the console's hold" — the whole balance works at the moment of purchase,
    // and a spend at exactly nowMs proves it against the emulator, not just
    // against a predicate.
    expect(spendableCents(b, T0)).toBe(b.balanceCents);
    const drawn = spend(r.value, {
      balanceId: b.id,
      amountCents: b.balanceCents,
      nowMs: T0,
      activityId: "act_spend",
    });
    expect(drawn.ok).toBe(true);
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

  // A top-up used to RE-LOCK the whole balance, so this is the pin on the
  // reversal: adding money to a balance cannot take away the money already on
  // it, not even for an hour.
  it("a top-up leaves the whole balance spendable", () => {
    const place = INHERITS;
    const first = buy(freshState(T0, "empty"), {
      placeId: place.id,
      paidCents: 50_000,
      nowMs: T0,
      balanceId: "b1",
      activityId: "a1",
      policy: POLICY,
    });
    if (!first.ok) return;
    const later = T0 + 30 * 24 * HOUR_MS;
    const second = buy(first.value, {
      placeId: place.id,
      paidCents: 50_000,
      nowMs: later,
      balanceId: "b2",
      activityId: "a2",
      policy: POLICY,
    });
    if (!second.ok) return;
    const b = second.value.balances[0];
    expect(spendableCents(b, later)).toBe(b.balanceCents);
  });
});

describe("spend", () => {
  function bought(): CreditsState {
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
  // Well short of the 90-day expiry. It used to be a year out, which is a DEAD
  // balance: the moment a spend is tested at has to sit before the expiry, and
  // picking one that does not is the exact mistake the expiry rule catches.
  const AFTER = T0 + 7 * 24 * HOUR_MS;

  it("draws the balance down and records it", () => {
    const s = bought();
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

  it("goes through at the instant of purchase — nothing to wait for", () => {
    const r = spend(bought(), {
      balanceId: "b1",
      amountCents: 1000,
      nowMs: T0,
      activityId: "a2",
    });
    expect(r.ok).toBe(true);
  });

  it("refuses more than is there, and refuses a non-positive amount", () => {
    const s = bought();
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
      spend(bought(), {
        balanceId: "nope",
        amountCents: 100,
        nowMs: AFTER,
        activityId: "a",
      }),
    ).toEqual({ ok: false, error: "unknown-balance" });
  });
});

describe("gift and redeem", () => {
  function gifted(nowMs = T0) {
    const r = gift(freshState(T0, "empty"), {
      placeId: OVERRIDES.id,
      paidCents: 100_000,
      note: "  Happy birthday  ",
      nowMs,
      code: "9123456780",
      policy: POLICY,
    });
    if (!r.ok) throw new Error("gift failed");
    return r.value;
  }

  // THE WHOLE POINT OF ISSUANCE (MESITA-1677). A gift that moved money out of
  // a balance would have to split a lot, and MESITA-1380 banned that. If this
  // ever goes red, someone has rebuilt gifting as a transfer.
  it("takes nothing out of the giver's wallet", () => {
    const { state, gift: g } = gifted();
    expect(state.balances).toEqual([]);
    expect(g.creditedCents).toBe(
      100_000 + bonusFor(100_000, bonusPctFor(OVERRIDES, POLICY)),
    );
    expect(g.paidCents).toBe(100_000);
    expect(g.redeemedAtMs).toBeNull();
    // Trimmed, and an all-space note is no note at all.
    expect(g.note).toBe("Happy birthday");
  });

  it("carries DAYS, so a code that waits does not arrive half dead", () => {
    const { state, gift: g } = gifted();
    expect(g.expiryDays).toBe(expiryDaysFor(OVERRIDES, POLICY));
    // Bought today, claimed a month later: the balance still gets the full
    // term, counted from the claim.
    const later = T0 + 30 * DAY_MS;
    const r = redeem(state, {
      code: g.code,
      nowMs: later,
      balanceId: "bal_g",
      activityId: "act_g",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const b = r.value.state.balances[0];
    expect(b.expiresAtMs).toBe(later + g.expiryDays * DAY_MS);
    expect(b.balanceCents).toBe(g.creditedCents);
    expect(b.placeName).toBe(OVERRIDES.name);
    expect(isExpired(b, later)).toBe(false);
  });

  it("spends once and says so the second time", () => {
    const { state, gift: g } = gifted();
    const first = redeem(state, {
      code: g.code,
      nowMs: T0,
      balanceId: "bal_1",
      activityId: "act_1",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.gift.redeemedAtMs).toBe(T0);
    expect(
      redeem(first.value.state, {
        code: g.code,
        nowMs: T0,
        balanceId: "bal_2",
        activityId: "act_2",
      }),
    ).toEqual({ ok: false, error: "gift-already-redeemed" });
  });

  // Two different problems for the guest: "that is not a code" sends them back
  // to their typing, "that was already used" sends them back to the giver.
  it("tells an unknown code apart from a used one", () => {
    const { state } = gifted();
    expect(
      redeem(state, {
        code: "0000000000",
        nowMs: T0,
        balanceId: "bal_x",
        activityId: "act_x",
      }),
    ).toEqual({ ok: false, error: "unknown-code" });
  });

  it("redeeming a gift tops up an existing balance at that place", () => {
    const bought = buy(freshState(T0, "empty"), {
      placeId: OVERRIDES.id,
      paidCents: 50_000,
      nowMs: T0,
      balanceId: "bal_own",
      activityId: "act_own",
      policy: POLICY,
    });
    if (!bought.ok) return;
    const g = gift(bought.value, {
      placeId: OVERRIDES.id,
      paidCents: 100_000,
      note: null,
      nowMs: T0,
      code: "9123456780",
      policy: POLICY,
    });
    if (!g.ok) return;
    const r = redeem(g.value.state, {
      code: "9123456780",
      nowMs: T0,
      balanceId: "bal_new",
      activityId: "act_new",
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    // ONE balance per place, still. The gift lands in the balance the guest
    // already had rather than opening a second card at the same restaurant.
    expect(r.value.state.balances).toHaveLength(1);
    expect(r.value.state.balances[0].id).toBe("bal_own");
    expect(r.value.state.balances[0].activity[0].label).toBe(
      "Redeemed a gift",
    );
  });

  it("rejects a gift of nothing, and a gift at a place that is not on Mesita", () => {
    const empty = freshState(T0, "empty");
    expect(
      gift(empty, {
        placeId: OVERRIDES.id,
        paidCents: 0,
        note: null,
        nowMs: T0,
        code: "9123456780",
        policy: POLICY,
      }),
    ).toEqual({ ok: false, error: "amount-not-positive" });
    expect(
      gift(empty, {
        placeId: "not-a-place",
        paidCents: 100_000,
        note: null,
        nowMs: T0,
        code: "9123456780",
        policy: POLICY,
      }),
    ).toEqual({ ok: false, error: "unknown-place" });
  });

  describe("giftCode", () => {
    it("is ten digits and never leads with a zero", () => {
      // A leading zero is the digit a paste path that treats the code as a
      // number silently eats.
      for (let i = 0; i < 200; i += 1) {
        const code = giftCode(new Set());
        expect(code).toMatch(/^[1-9][0-9]{9}$/);
      }
    });

    it("retries past a code already issued", () => {
      // Forces the collision: the first ten draws reproduce the code that is
      // already taken, so a generator that does not check would hand it back.
      const taken = new Set([giftCode(new Set(), () => 0)]);
      let draw = 0;
      const rand = () => (draw++ < 10 ? 0 : 0.5);
      const next = giftCode(taken, rand);
      expect(taken.has(next)).toBe(false);
      expect(next).toMatch(/^[1-9][0-9]{9}$/);
      // It really did take two passes, not one lucky one.
      expect(draw).toBe(20);
    });

    it("gives up rather than hand back a duplicate", () => {
      const taken = new Set([giftCode(new Set(), () => 0)]);
      expect(() => giftCode(taken, () => 0)).toThrow("no free code");
    });
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
    expect(b.expiresAtMs).toBe(T0 + OVERRIDES.expiryDays! * DAY_MS);
  });

  it("no seeded balance ships already dead", () => {
    for (const b of seeded().balances) {
      expect(isExpired(b, T0)).toBe(false);
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

  // Time kills a balance; nothing writes to it. There is no demo clock any
  // more, so "later" is an explicit nowMs — which is what every rule here has
  // always taken anyway.
  it("dies by the passage of time, without being touched", () => {
    const b = seeded().balances[0];
    const days = Math.ceil(daysUntilExpiry(b, T0));
    const dead = T0 + (days + 1) * 24 * HOUR_MS;
    expect(isExpired(b, dead)).toBe(true);
    expect(spendableCents(b, dead)).toBe(0);
    expect(b.balanceCents).toBeGreaterThan(0);
  });
});

describe("list order", () => {
  it("ranks spendable before expired", () => {
    const s = seeded();
    // Past the shortest life in the fixture but not the longest, so the list
    // actually holds both states at once.
    const dead = s.balances[0].expiresAtMs + DAY_MS;
    const ranked = rankBalances(s.balances, dead);
    const states = ranked.map((b) => (isExpired(b, dead) ? 1 : 0));
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
    "src/components/consumer/credits/BalanceList.tsx",
    "src/components/consumer/credits/PickCredits.tsx",
    // BalanceDetail.tsx and BuyCreditsSheet.tsx are gone (2026-09-08): the
    // sheets became the four full-screen routes below, and the naming rule
    // follows the money onto them.
    "src/app/(shell)/new-visit/wallet/buy/BuyClient.tsx",
    "src/app/(shell)/new-visit/wallet/gift/GiftClient.tsx",
    "src/app/(shell)/new-visit/wallet/redeem/RedeemClient.tsx",
    "src/app/(shell)/new-visit/wallet/balance/[id]/BalanceClient.tsx",
    "src/lib/mock/credits-mock.ts",
    "src/lib/mock/credits-emulator.ts",
  ];
  const CONTAINER_SRC = ["src/app/(shell)/new-visit/wallet/CreditsClient.tsx"];

  // The FRAME may be named after the container, because it IS the container:
  // WalletScreen is the back-title-body-footer shell all four money screens
  // wear, and WalletParkedNote is the "none of this is money yet" line it
  // carries. Same exemption CreditsClient already has, for the same reason —
  // what the rule is hunting is an INSTRUMENT named after the container, and
  // `WalletBalance` is still caught by everything below.
  const FRAME = /^(WalletScreen|WalletParkedNote)$/;

  function read(rel: string): string {
    return readFileSync(join(__dirname, "..", "..", "..", rel), "utf8");
  }

  it.each(MONEY_SRC)("%s declares no Wallet* identifier", (rel) => {
    const hits = (read(rel).match(/\bWallet[A-Z]\w*/g) ?? []).filter(
      (name) => !FRAME.test(name),
    );
    expect(hits).toEqual([]);
  });

  it.each([...MONEY_SRC, ...CONTAINER_SRC])(
    "%s declares no Prepay* identifier",
    (rel) => {
      expect(read(rel).match(/\bPrepay[A-Z]\w*/g) ?? []).toEqual([]);
    },
  );
});

// ── The Wallet's block order (MESITA-1673) ───────────────────────────────────
//
// A SOURCE-TEXT CONTRACT, because this package runs Vitest with environment
// "node" and the ordering cannot be observed any other way. It is here rather
// than left to review because it is the most CONTESTED decision on the screen:
// both design passes on the Credits plan argued that the guest's own money
// should lead the surface they opened to check it, and Pato overruled them.
//
// His reason is a product reason and it is the whole reason Pay was cut from
// the wallet's main actions earlier: Credits must never read as REQUIRED, and
// putting the ordinary way to pay first is what says the prepaid balance under
// it is optional. Anyone flipping this order is reversing that, and should have
// to delete this test to do it.
describe("wallet block order", () => {
  const CLIENT = readFileSync(
    join(__dirname, "..", "..", "app", "(shell)", "new-visit", "wallet", "CreditsClient.tsx"),
    "utf8",
  );

  it("puts Cards above Credits", () => {
    const cards = CLIENT.indexOf('aria-label="Cards"');
    const credits = CLIENT.indexOf('aria-label="Credits"');
    expect(cards).toBeGreaterThan(-1);
    expect(credits).toBeGreaterThan(-1);
    expect(cards).toBeLessThan(credits);
  });

  it("renders Ways to pay only while the guest holds nothing", () => {
    // Unpressable AND undismissable is worse than either alone — this app
    // already deleted the Gift tile for the first half of that. The block is
    // read once, so it leaves once there is a balance to read instead.
    expect(CLIENT).toMatch(/balances\.length === 0 \? <WaysToPay \/> : null/);
  });

  it("mounts the shared card list, never a second one", () => {
    // CardsModal's own header comment exists to guarantee the live Stripe flow
    // has exactly one definition. Rendering cards inline is where that would
    // quietly become two.
    expect(CLIENT).toContain("useConsumerCards");
    expect(CLIENT).toContain("<CardList");
    expect(CLIENT).not.toContain("apiListCards");
  });
});
