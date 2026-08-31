// SPIKE FIXTURE — example Credits balances for the /credits surface.
//
// NOTHING HERE IS LIVE. There is no table, no Edge Function and no type for a
// prepaid balance, and the VENUE side does not exist at all: a place today
// cannot set a bonus, cannot set a maturation window, and cannot see what it
// owes. This file exists so the surface can be judged before any of that is
// built (MESITA-1380).
//
// What is deliberately UNDECIDED and must not be read out of this fixture:
//   · the bonus ladder (does a longer lock earn a bigger bonus, and how much)
//   · who issues the instrument — the place or Mesita
//   · whether balances expire, and what happens to the remainder if they do
//   · the cross-venue balance, which is gated to Capital-debt venues and has
//     no book behind it yet
//
// Maturation is stored as a RELATIVE offset, never an absolute date. An ISO
// timestamp in a fixture goes stale the day after it is written, and computing
// "time remaining" from `new Date()` during render mismatches between the
// server pass and the client pass. Hours are inert data.

export type CreditActivity = {
  id: string;
  label: string;
  /** Signed, in cents. Negative spends, positive tops up. */
  amountCents: number;
  /** Display-only, e.g. "12 Aug". Never parsed. */
  when: string;
};

export type CreditBalance = {
  id: string;
  placeId: string;
  placeName: string;
  /** Total held at this place, in cents. 1 Credit = MX$1. */
  balanceCents: number;
  /** What the guest actually paid. balance - paid = the bonus. */
  paidCents: number;
  /** Hours until this balance unlocks. null = spendable now. */
  maturesInHours: number | null;
  /** The place's own bonus, as a whole percent. */
  bonusPct: number;
  activity: CreditActivity[];
};

/** Spendable right now — a locked balance contributes nothing. */
export function spendableCents(b: CreditBalance): number {
  return b.maturesInHours == null ? b.balanceCents : 0;
}

export function isLocked(b: CreditBalance): boolean {
  return b.maturesInHours != null;
}

/**
 * "18h" under a day, "6d" beyond it. Days are what a lock is actually measured
 * in, so a minutes-and-seconds countdown would be a rerender per second for
 * information nobody acts on.
 */
export function formatUnlock(hours: number): string {
  if (hours < 24) return `${Math.max(1, Math.round(hours))}h`;
  return `${Math.round(hours / 24)}d`;
}

// The stack. Deliberately includes one very long place name (39 chars) so
// truncation is visible in review rather than in production, one locked
// balance, and one balance whose bonus differs from the others — the place
// sets its own, so a uniform ladder would be a fixture that lies.
const STACK: CreditBalance[] = [
  {
    id: "bal_lardo",
    placeId: "plc_lardo",
    placeName: "Lardo",
    balanceCents: 124_000,
    paidCents: 110_000,
    maturesInHours: null,
    bonusPct: 13,
    activity: [
      { id: "a1", label: "Dinner", amountCents: -48_000, when: "24 Aug" },
      { id: "a2", label: "Bought Credits", amountCents: 110_000, when: "12 Aug" },
    ],
  },
  {
    id: "bal_toño",
    placeId: "plc_tono",
    placeName: "Restaurante La Casa de Toño Insurgentes",
    balanceCents: 42_500,
    paidCents: 40_000,
    maturesInHours: null,
    bonusPct: 6,
    activity: [
      { id: "b1", label: "Comida", amountCents: -27_500, when: "22 Aug" },
      { id: "b2", label: "Bought Credits", amountCents: 40_000, when: "19 Aug" },
    ],
  },
  {
    id: "bal_pangea",
    placeId: "plc_pangea",
    placeName: "Pangea",
    balanceCents: 200_000,
    paidCents: 160_000,
    maturesInHours: 18,
    bonusPct: 25,
    activity: [
      { id: "c1", label: "Bought Credits", amountCents: 200_000, when: "31 Aug" },
    ],
  },
  {
    id: "bal_cafe",
    placeId: "plc_cafe",
    placeName: "Café Nueve",
    balanceCents: 8_400,
    paidCents: 8_000,
    maturesInHours: null,
    bonusPct: 5,
    activity: [
      { id: "d1", label: "Flat white", amountCents: -9_500, when: "29 Aug" },
      { id: "d2", label: "Bought Credits", amountCents: 8_000, when: "15 Aug" },
    ],
  },
];

// The honest year-one case: ONE balance, mid-lock, nothing spendable. If the
// surface only reads well at n=4 it does not read well, so this stays one
// query string away rather than buried.
const SOLO: CreditBalance[] = [
  {
    id: "bal_pangea",
    placeId: "plc_pangea",
    placeName: "Pangea",
    balanceCents: 200_000,
    paidCents: 160_000,
    maturesInHours: 18,
    bonusPct: 25,
    activity: [
      { id: "c1", label: "Bought Credits", amountCents: 200_000, when: "31 Aug" },
    ],
  },
];

export function mockBalances(variant: "stack" | "solo" | "empty"): CreditBalance[] {
  if (variant === "solo") return SOLO;
  if (variant === "empty") return [];
  return STACK;
}
