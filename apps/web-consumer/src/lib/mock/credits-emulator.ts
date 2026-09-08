// The /credits EMULATOR — a fake backend that lives in the browser.
//
// There is no credits table and no consumer-web-credits-* Edge Function. This
// stands in for both so the surface can be exercised end to end: buy a balance,
// spend it, gift one, redeem the code. It is the only reason Wallet does
// anything.
//
// SHAPED LIKE THE EDGE FUNCTIONS IT REPLACES. Every operation is async, returns
// a result envelope, and takes the arguments the real endpoint would take, so
// swapping in `consumer-web-*` later is a change of implementation and not of
// call sites. Clients call Edge Functions and never the DB (root CLAUDE.md);
// nothing here should teach a future session otherwise.
//
// BUYING IS ACTIVATION (Pato, 2026-09-08). A top-up used to sit inside a hold
// before it could be spent, and a DEMO CLOCK — a `clockOffsetMs` on state, with
// +1h/+24h/+30d buttons on the surface — existed to make that window visible in
// a demo. The hold is gone, so the clock had nothing left to demonstrate that
// was worth the furniture, and it went with it. Every read is wall time now.
// Expiry survives and is still enforced here; at 90 days out it is simply not
// something a demo session walks to.
//
// GIFTING IS ISSUANCE, NOT TRANSFER (MESITA-1677). You buy a balance FOR
// someone else; you never move money out of one you already hold. That is a
// schema decision before it is a product one — a held balance is one lot with
// one expiry and one bonus rate, and splitting it would need a second lot with
// a re-derived rate, which MESITA-1380 banned outright. So `gift()` here reads
// exactly like `buy()` and produces a CODE instead of a balance, and `redeem()`
// is the only thing that turns that code into money.

import {
  bonusFor,
  bonusPctFor,
  CONTROLS_FALLBACK,
  DAY_MS,
  expiryDaysFor,
  isExpired,
  placeById,
  seedBalances,
  type ControlsPolicy,
  type CreditBalance,
  type CreditPlace,
} from "./credits-mock";

const STORAGE_KEY = "mesita.credits.emulator";
// 4: gifts (MESITA-1677). Unlike v2 -> v3, this bump is PURELY ADDITIVE — a v3
// wallet has every field a v4 wallet needs and one it does not have yet — so
// `read()` MIGRATES it instead of dropping it. v3 dropped its predecessor
// because a stored `clockOffsetMs` was a dead field nothing could move; there
// is no equivalent here, and re-seeding would throw away a demo wallet for no
// reason a guest could see.
const STATE_VERSION = 4;

/** A balance bought FOR someone else, waiting on its code. */
export type CreditGift = {
  /** Ten digits. The whole gift — there is no account behind it. */
  code: string;
  placeId: string;
  placeName: string;
  paidCents: number;
  /** What the code is worth once redeemed: paid + bonus, resolved at purchase. */
  creditedCents: number;
  bonusPct: number;
  /** Carried, not spent: the clock starts when the code is REDEEMED. */
  expiryDays: number;
  /** Optional line from the giver, shown to whoever redeems it. */
  note: string | null;
  createdAtMs: number;
  redeemedAtMs: number | null;
};

export type CreditsState = {
  v: typeof STATE_VERSION;
  balances: CreditBalance[];
  gifts: CreditGift[];
};

export type EmulatorError =
  | "unknown-place"
  | "unknown-balance"
  | "balance-expired"
  | "insufficient-credits"
  | "amount-not-positive"
  | "unknown-code"
  | "gift-already-redeemed";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: EmulatorError };

/** `empty` exists so the zero state is reachable without spending three balances to nothing. */
export type Seed = "default" | "empty";

export function freshState(
  nowMs: number,
  seed: Seed = "default",
  policy: ControlsPolicy = CONTROLS_FALLBACK,
): CreditsState {
  return {
    v: STATE_VERSION,
    balances: seed === "empty" ? [] : seedBalances(nowMs, policy),
    gifts: [],
  };
}

// ─── Pure operations ───────────────────────────────────────────────────────
// Every one takes the ids and timestamps it needs rather than reaching for
// Date.now() or a random source, so the whole ruleset is testable without
// faking globals.

/**
 * Put credited money into the wallet at one place.
 *
 * Shared by `buy` and `redeem` because the two differ only in where the money
 * came from — once it lands, a bought balance and a redeemed gift are the same
 * object with the same terms, and a second copy of this merge is a second place
 * for the expiry rule to drift.
 *
 * Topping up an existing balance RE-DATES its expiry, in the guest's favour:
 * the older money rides the new date rather than the new money inheriting the
 * old one. A single balance can only carry one date, and the alternative — new
 * Credits dying on the schedule of Credits bought months ago — would take away
 * a term the guest just paid for.
 */
function creditInto(
  balances: CreditBalance[],
  args: {
    place: CreditPlace;
    paidCents: number;
    creditedCents: number;
    bonusPct: number;
    expiresAtMs: number;
    nowMs: number;
    balanceId: string;
    activityId: string;
    label: string;
  },
): CreditBalance[] {
  const existing = balances.find((b) => b.placeId === args.place.id);
  const entry = {
    id: args.activityId,
    label: args.label,
    amountCents: args.creditedCents,
    atMs: args.nowMs,
  };

  const next: CreditBalance = existing
    ? {
        ...existing,
        balanceCents: existing.balanceCents + args.creditedCents,
        paidCents: existing.paidCents + args.paidCents,
        expiresAtMs: args.expiresAtMs,
        bonusPct: args.bonusPct,
        activity: [entry, ...existing.activity],
      }
    : {
        id: args.balanceId,
        placeId: args.place.id,
        placeName: args.place.name,
        balanceCents: args.creditedCents,
        paidCents: args.paidCents,
        expiresAtMs: args.expiresAtMs,
        bonusPct: args.bonusPct,
        photoUrl: args.place.photoUrl,
        activity: [entry],
      };

  return existing
    ? balances.map((b) => (b.id === existing.id ? next : b))
    : [...balances, next];
}

export function buy(
  state: CreditsState,
  args: {
    placeId: string;
    paidCents: number;
    nowMs: number;
    balanceId: string;
    activityId: string;
    /** Console-owned terms. A place's own values still win where it set them. */
    policy: ControlsPolicy;
  },
): Result<CreditsState> {
  const place = placeById(args.placeId);
  if (!place) return { ok: false, error: "unknown-place" };
  if (args.paidCents <= 0) return { ok: false, error: "amount-not-positive" };

  // The bonus and the expiry are resolved TOGETHER and stored on the balance,
  // so a later console change never silently reprices Credits a guest already
  // bought. What the operator changes is what the NEXT top-up gets.
  const bonusPct = bonusPctFor(place, args.policy);
  const credited = args.paidCents + bonusFor(args.paidCents, bonusPct);
  // The whole balance is spendable from here: there is no window between buying
  // Credits and being able to use them.
  const expiresAtMs = args.nowMs + expiryDaysFor(place, args.policy) * DAY_MS;

  return {
    ok: true,
    value: {
      ...state,
      balances: creditInto(state.balances, {
        place,
        paidCents: args.paidCents,
        creditedCents: credited,
        bonusPct,
        expiresAtMs,
        nowMs: args.nowMs,
        balanceId: args.balanceId,
        activityId: args.activityId,
        label: "Bought Credits",
      }),
    },
  };
}

/**
 * Buy a balance for someone else. Produces a CODE, not a balance.
 *
 * Nothing lands in the giver's wallet — that is the whole difference from
 * `buy`, and it is why a gift never has to split a lot. The terms are resolved
 * and frozen here exactly as a purchase freezes them, so a console change
 * between gifting and redeeming cannot reprice a code someone is holding.
 */
export function gift(
  state: CreditsState,
  args: {
    placeId: string;
    paidCents: number;
    note: string | null;
    nowMs: number;
    code: string;
    policy: ControlsPolicy;
  },
): Result<{ state: CreditsState; gift: CreditGift }> {
  const place = placeById(args.placeId);
  if (!place) return { ok: false, error: "unknown-place" };
  if (args.paidCents <= 0) return { ok: false, error: "amount-not-positive" };

  const bonusPct = bonusPctFor(place, args.policy);
  const created: CreditGift = {
    code: args.code,
    placeId: place.id,
    placeName: place.name,
    paidCents: args.paidCents,
    creditedCents: args.paidCents + bonusFor(args.paidCents, bonusPct),
    bonusPct,
    // Days, not a date. The life of the money starts when it becomes money —
    // see `redeem`. A gift that sat in a WhatsApp thread for a month must not
    // arrive with a month already burnt off it.
    expiryDays: expiryDaysFor(place, args.policy),
    note: args.note?.trim() ? args.note.trim() : null,
    createdAtMs: args.nowMs,
    redeemedAtMs: null,
  };

  return {
    ok: true,
    value: {
      state: { ...state, gifts: [created, ...state.gifts] },
      gift: created,
    },
  };
}

/** Turn a code into money. The only way a gift ever becomes a balance. */
export function redeem(
  state: CreditsState,
  args: {
    code: string;
    nowMs: number;
    balanceId: string;
    activityId: string;
  },
): Result<{ state: CreditsState; gift: CreditGift }> {
  const found = state.gifts.find((g) => g.code === args.code);
  if (!found) return { ok: false, error: "unknown-code" };
  // Told apart from unknown ON PURPOSE. "That code was already used" is a
  // different problem from "that is not a code", and a guest reading a number
  // off a screenshot needs to know which one they have.
  if (found.redeemedAtMs !== null)
    return { ok: false, error: "gift-already-redeemed" };
  const place = placeById(found.placeId);
  if (!place) return { ok: false, error: "unknown-place" };

  const claimed: CreditGift = { ...found, redeemedAtMs: args.nowMs };

  return {
    ok: true,
    value: {
      state: {
        ...state,
        balances: creditInto(state.balances, {
          place,
          paidCents: found.paidCents,
          creditedCents: found.creditedCents,
          bonusPct: found.bonusPct,
          // The clock starts NOW, not when the gift was bought.
          expiresAtMs: args.nowMs + found.expiryDays * DAY_MS,
          nowMs: args.nowMs,
          balanceId: args.balanceId,
          activityId: args.activityId,
          label: "Redeemed a gift",
        }),
        gifts: state.gifts.map((g) => (g.code === claimed.code ? claimed : g)),
      },
      gift: claimed,
    },
  };
}

export function spend(
  state: CreditsState,
  args: {
    balanceId: string;
    amountCents: number;
    nowMs: number;
    activityId: string;
    label?: string;
  },
): Result<CreditsState> {
  const balance = state.balances.find((b) => b.id === args.balanceId);
  if (!balance) return { ok: false, error: "unknown-balance" };
  if (args.amountCents <= 0) return { ok: false, error: "amount-not-positive" };
  // Expiry is checked BEFORE the amount: a guest who typed too much into a dead
  // balance needs to be told it is dead, not that they were a few pesos over.
  if (isExpired(balance, args.nowMs))
    return { ok: false, error: "balance-expired" };
  if (args.amountCents > balance.balanceCents)
    return { ok: false, error: "insufficient-credits" };

  const next: CreditBalance = {
    ...balance,
    balanceCents: balance.balanceCents - args.amountCents,
    activity: [
      {
        id: args.activityId,
        label: args.label ?? "Paid a bill",
        amountCents: -args.amountCents,
        atMs: args.nowMs,
      },
      ...balance.activity,
    ],
  };

  return {
    ok: true,
    value: {
      ...state,
      balances: state.balances.map((b) => (b.id === next.id ? next : b)),
    },
  };
}

/**
 * Ten digits, not taken.
 *
 * Digits only because `PinField` is a numeric keypad — a code that a guest
 * reads off a screenshot must have no case and no letter/number ambiguity in
 * it. Never starts with 0 so the leading digit survives every paste path that
 * treats the thing as a number.
 */
export function giftCode(
  taken: ReadonlySet<string>,
  rand: () => number = Math.random,
): string {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    let code = String(1 + Math.floor(rand() * 9));
    for (let i = 1; i < 10; i += 1) code += String(Math.floor(rand() * 10));
    if (!taken.has(code)) return code;
  }
  // 50 collisions against a wallet that holds a handful of gifts is not a case
  // that happens; returning a duplicate silently would be, so it throws.
  throw new Error("giftCode: no free code");
}

// ─── Persistence ───────────────────────────────────────────────────────────
// Every access is guarded: private windows throw on read AND write, and a
// state written by an older shape must never crash the page it loads into.

function read(): CreditsState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CreditsState>;
    if (!Array.isArray(parsed?.balances)) return null;
    // v3 is a v4 wallet that has never been gifted from — see STATE_VERSION.
    if (parsed.v !== STATE_VERSION && parsed.v !== 3) return null;
    return {
      v: STATE_VERSION,
      balances: parsed.balances,
      gifts: Array.isArray(parsed.gifts) ? parsed.gifts : [],
    };
  } catch {
    return null;
  }
}

function write(state: CreditsState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode, blocked site data, quota. The surface still works for this
    // session; it just will not survive a reload.
  }
}

// ─── The async surface, shaped like the Edge Functions ─────────────────────

/** Latency so loading states are exercised rather than theoretical. */
const LATENCY_MS = 220;

function settle<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

let nextId = 0;
function id(prefix: string): string {
  nextId += 1;
  return `${prefix}_${Date.now().toString(36)}${nextId}`;
}

export async function emulatorLoad(
  seed: Seed,
  policy: ControlsPolicy = CONTROLS_FALLBACK,
): Promise<CreditsState> {
  const stored = read();
  if (stored) return settle(stored);
  const seeded = freshState(Date.now(), seed, policy);
  write(seeded);
  return settle(seeded);
}

export async function emulatorBuy(
  state: CreditsState,
  placeId: string,
  paidCents: number,
  policy: ControlsPolicy = CONTROLS_FALLBACK,
): Promise<Result<CreditsState>> {
  const result = buy(state, {
    placeId,
    paidCents,
    nowMs: Date.now(),
    balanceId: id("bal"),
    activityId: id("act"),
    policy,
  });
  if (result.ok) write(result.value);
  return settle(result);
}

export async function emulatorGift(
  state: CreditsState,
  placeId: string,
  paidCents: number,
  note: string | null,
  policy: ControlsPolicy = CONTROLS_FALLBACK,
): Promise<Result<{ state: CreditsState; gift: CreditGift }>> {
  const result = gift(state, {
    placeId,
    paidCents,
    note,
    nowMs: Date.now(),
    code: giftCode(new Set(state.gifts.map((g) => g.code))),
    policy,
  });
  if (result.ok) write(result.value.state);
  return settle(result);
}

export async function emulatorRedeem(
  state: CreditsState,
  code: string,
): Promise<Result<{ state: CreditsState; gift: CreditGift }>> {
  const result = redeem(state, {
    code,
    nowMs: Date.now(),
    balanceId: id("bal"),
    activityId: id("act"),
  });
  if (result.ok) write(result.value.state);
  return settle(result);
}

export async function emulatorSpend(
  state: CreditsState,
  balanceId: string,
  amountCents: number,
): Promise<Result<CreditsState>> {
  const result = spend(state, {
    balanceId,
    amountCents,
    nowMs: Date.now(),
    activityId: id("act"),
  });
  if (result.ok) write(result.value);
  return settle(result);
}
