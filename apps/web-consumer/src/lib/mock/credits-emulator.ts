// The /credits EMULATOR — a fake backend that lives in the browser.
//
// There is no credits table and no consumer-web-credits-* Edge Function. This
// stands in for both so the surface can be exercised end to end: buy a balance,
// spend it, watch a lock mature. It is the only reason /credits does anything.
//
// SHAPED LIKE THE EDGE FUNCTIONS IT REPLACES. Every operation is async, returns
// a result envelope, and takes the arguments the real endpoint would take, so
// swapping in `consumer-web-*` later is a change of implementation and not of
// call sites. Clients call Edge Functions and never the DB (root CLAUDE.md);
// nothing here should teach a future session otherwise.
//
// THE CLOCK IS THE POINT. Real maturation is measured in hours and days, and
// expiry in months, so a demo that waits for wall time demonstrates nothing.
// State stores absolute timestamps and a single `clockOffsetMs`; every read
// derives "now" from `Date.now() + offset`. Pushing the clock forward runs the
// SAME maturation logic a real 18-hour wait would, which is what makes the lock
// legible — and the same expiry logic a real 90-day wait would.

import {
  bonusFor,
  bonusPctFor,
  CONTROLS_FALLBACK,
  DAY_MS,
  expiryDaysFor,
  holdHoursFor,
  HOUR_MS,
  isExpired,
  placeById,
  seedBalances,
  type ControlsPolicy,
  type CreditBalance,
} from "./credits-mock";

const STORAGE_KEY = "mesita.credits.emulator";
// 2: balances carry `expiresAtMs` (2026-09-02). A v1 balance has no expiry, and
// `isExpired` on an undefined date is quietly false — money that never dies,
// which is the one thing this shape change exists to stop. `read()` drops a
// state whose version does not match, so a stale wallet re-seeds instead of
// running the new rules against a shape that cannot answer them.
const STATE_VERSION = 2;

export type CreditsState = {
  v: typeof STATE_VERSION;
  balances: CreditBalance[];
  /** Milliseconds added to wall time. The demo clock, never persisted as "now". */
  clockOffsetMs: number;
};

export type EmulatorError =
  | "unknown-place"
  | "unknown-balance"
  | "balance-locked"
  | "balance-expired"
  | "insufficient-credits"
  | "amount-not-positive";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: EmulatorError };

function nowMsFor(state: CreditsState): number {
  return Date.now() + state.clockOffsetMs;
}

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
    clockOffsetMs: 0,
  };
}

// ─── Pure operations ───────────────────────────────────────────────────────
// Every one takes the ids and timestamps it needs rather than reaching for
// Date.now() or a random source, so the whole ruleset is testable without
// faking globals.

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

  // The hold, the bonus and the expiry are resolved TOGETHER and stored on the
  // balance, so a later console change never silently reprices Credits a guest
  // already bought. What the operator changes is what the NEXT top-up gets.
  const bonusPct = bonusPctFor(place, args.policy);
  const credited = args.paidCents + bonusFor(args.paidCents, bonusPct);
  const maturesAtMs = args.nowMs + holdHoursFor(place, args.policy) * HOUR_MS;
  // From the TOP-UP, not from maturity. Dating expiry off the unlock would let
  // a place buy its Credits a longer life by holding them longer, which is the
  // opposite of what the hold costs a guest.
  const expiresAtMs = args.nowMs + expiryDaysFor(place, args.policy) * DAY_MS;
  const existing = state.balances.find((b) => b.placeId === args.placeId);

  // Topping up an existing balance RE-LOCKS the whole thing. The lock is what
  // the place is paying the bonus for, so letting new money hide behind an
  // already-matured balance would sell float that was never delivered.
  //
  // It RE-DATES the expiry the same way, and in the guest's favour: the older
  // money rides the new expiry rather than the new money inheriting the old
  // one. A single balance can only carry one date, and the alternative — new
  // Credits dying on the schedule of Credits bought months ago — would take
  // away a term the guest just paid for.
  const next: CreditBalance = existing
    ? {
        ...existing,
        balanceCents: existing.balanceCents + credited,
        paidCents: existing.paidCents + args.paidCents,
        maturesAtMs,
        expiresAtMs,
        bonusPct,
        activity: [
          {
            id: args.activityId,
            label: "Bought Credits",
            amountCents: credited,
            atMs: args.nowMs,
          },
          ...existing.activity,
        ],
      }
    : {
        id: args.balanceId,
        placeId: place.id,
        placeName: place.name,
        balanceCents: credited,
        paidCents: args.paidCents,
        maturesAtMs,
        expiresAtMs,
        bonusPct,
        photoUrl: place.photoUrl,
        activity: [
          {
            id: args.activityId,
            label: "Bought Credits",
            amountCents: credited,
            atMs: args.nowMs,
          },
        ],
      };

  return {
    ok: true,
    value: {
      ...state,
      balances: existing
        ? state.balances.map((b) => (b.id === existing.id ? next : b))
        : [...state.balances, next],
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
  if (balance.maturesAtMs > args.nowMs)
    return { ok: false, error: "balance-locked" };
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

export function advanceClock(
  state: CreditsState,
  hours: number,
): CreditsState {
  return { ...state, clockOffsetMs: state.clockOffsetMs + hours * HOUR_MS };
}

// ─── Persistence ───────────────────────────────────────────────────────────
// Every access is guarded: private windows throw on read AND write, and a
// state written by an older shape must never crash the page it loads into.

function read(): CreditsState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CreditsState>;
    if (parsed?.v !== STATE_VERSION || !Array.isArray(parsed.balances))
      return null;
    return {
      v: STATE_VERSION,
      balances: parsed.balances,
      clockOffsetMs:
        typeof parsed.clockOffsetMs === "number" ? parsed.clockOffsetMs : 0,
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
    nowMs: nowMsFor(state),
    balanceId: id("bal"),
    activityId: id("act"),
    policy,
  });
  if (result.ok) write(result.value);
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
    nowMs: nowMsFor(state),
    activityId: id("act"),
  });
  if (result.ok) write(result.value);
  return settle(result);
}

/** Synchronous on purpose — the clock is a demo control, not a request. */
export function emulatorAdvance(
  state: CreditsState,
  hours: number,
): CreditsState {
  const next = advanceClock(state, hours);
  write(next);
  return next;
}

export function emulatorReset(
  seed: Seed,
  policy: ControlsPolicy = CONTROLS_FALLBACK,
): CreditsState {
  const next = freshState(Date.now(), seed, policy);
  write(next);
  return next;
}
