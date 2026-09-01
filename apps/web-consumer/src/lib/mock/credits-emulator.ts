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
// THE CLOCK IS THE POINT. Real maturation is measured in hours and days, so a
// demo that waits for wall time demonstrates nothing. State stores absolute
// timestamps and a single `clockOffsetMs`; every read derives "now" from
// `Date.now() + offset`. Pushing the clock forward runs the SAME maturation
// logic a real 18-hour wait would, which is what makes the lock legible.

import {
  bonusFor,
  HOUR_MS,
  placeById,
  seedBalances,
  type CreditBalance,
} from "./credits-mock";

const STORAGE_KEY = "mesita.credits.emulator";
const STATE_VERSION = 1;

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
  | "insufficient-credits"
  | "amount-not-positive";

export type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: EmulatorError };

export function nowMsFor(state: CreditsState): number {
  return Date.now() + state.clockOffsetMs;
}

/** `empty` exists so the zero state is reachable without spending three balances to nothing. */
export type Seed = "default" | "empty";

export function freshState(nowMs: number, seed: Seed = "default"): CreditsState {
  return {
    v: STATE_VERSION,
    balances: seed === "empty" ? [] : seedBalances(nowMs),
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
  },
): Result<CreditsState> {
  const place = placeById(args.placeId);
  if (!place) return { ok: false, error: "unknown-place" };
  if (args.paidCents <= 0) return { ok: false, error: "amount-not-positive" };

  const credited = args.paidCents + bonusFor(args.paidCents, place.bonusPct);
  const maturesAtMs = args.nowMs + place.lockHours * HOUR_MS;
  const existing = state.balances.find((b) => b.placeId === args.placeId);

  // Topping up an existing balance RE-LOCKS the whole thing. The lock is what
  // the place is paying the bonus for, so letting new money hide behind an
  // already-matured balance would sell float that was never delivered.
  const next: CreditBalance = existing
    ? {
        ...existing,
        balanceCents: existing.balanceCents + credited,
        paidCents: existing.paidCents + args.paidCents,
        maturesAtMs,
        bonusPct: place.bonusPct,
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
        bonusPct: place.bonusPct,
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

export async function emulatorLoad(seed: Seed): Promise<CreditsState> {
  const stored = read();
  if (stored) return settle(stored);
  const seeded = freshState(Date.now(), seed);
  write(seeded);
  return settle(seeded);
}

export async function emulatorBuy(
  state: CreditsState,
  placeId: string,
  paidCents: number,
): Promise<Result<CreditsState>> {
  const result = buy(state, {
    placeId,
    paidCents,
    nowMs: nowMsFor(state),
    balanceId: id("bal"),
    activityId: id("act"),
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

export function emulatorReset(seed: Seed): CreditsState {
  const next = freshState(Date.now(), seed);
  write(next);
  return next;
}
