// SPIKE FIXTURE — the seed data behind the /credits emulator.
//
// NOTHING HERE IS LIVE. There is no table, no Edge Function and no type for a
// prepaid balance, and the VENUE side does not exist at all: a place today
// cannot set a bonus, cannot set a lock window, and cannot see what it owes.
// This exists so the surface can be exercised before any of that is built
// (MESITA-1380).
//
// What is deliberately UNDECIDED and must not be read out of this fixture:
//   · the exact bonus ladder — the shape (longer lock earns more) is the point,
//     the numbers are invented
//   · who issues the instrument, the place or Mesita
//   · whether balances expire, and what happens to the remainder if they do
//   · the cross-venue balance, gated to Capital-debt venues, which has no book
//     behind it yet

export type CreditActivity = {
  id: string;
  label: string;
  /** Signed, in cents. Negative spends, positive tops up. */
  amountCents: number;
  /** Real epoch ms. Rendered against the emulator clock, never against wall time. */
  atMs: number;
};

export type CreditBalance = {
  id: string;
  placeId: string;
  placeName: string;
  /** Total held at this place, in cents. 1 Credit = MX$1. */
  balanceCents: number;
  /** What the guest actually paid. balance - paid = the bonus. */
  paidCents: number;
  /** Real epoch ms when this unlocks. Compared against the emulator clock. */
  maturesAtMs: number;
  /** The place's own bonus, as a whole percent. */
  bonusPct: number;
  activity: CreditActivity[];
};

/**
 * A place you can prepay. The place sets BOTH numbers, and the pairing is the
 * model: a longer lock earns a bigger bonus, because what the place is buying
 * is float. That makes a prepay a term deposit rather than a discount at the
 * table, which is the whole reason the lock exists.
 */
export type CreditPlace = {
  id: string;
  name: string;
  bonusPct: number;
  lockHours: number;
};

export const CREDIT_PLACES: CreditPlace[] = [
  { id: "plc_cafe", name: "Café Nueve", bonusPct: 5, lockHours: 12 },
  {
    id: "plc_tono",
    name: "Restaurante La Casa de Toño Insurgentes",
    bonusPct: 8,
    lockHours: 24,
  },
  { id: "plc_lardo", name: "Lardo", bonusPct: 13, lockHours: 24 },
  { id: "plc_pangea", name: "Pangea", bonusPct: 25, lockHours: 72 },
];

export function placeById(id: string): CreditPlace | undefined {
  return CREDIT_PLACES.find((p) => p.id === id);
}

export const HOUR_MS = 3_600_000;

export function isLocked(b: CreditBalance, nowMs: number): boolean {
  return b.maturesAtMs > nowMs;
}

/** Spendable right now — a locked balance contributes nothing. */
export function spendableCents(b: CreditBalance, nowMs: number): number {
  return isLocked(b, nowMs) ? 0 : b.balanceCents;
}

export function hoursUntil(b: CreditBalance, nowMs: number): number {
  return (b.maturesAtMs - nowMs) / HOUR_MS;
}

/**
 * "18h" under a day, "6d" beyond it. Days are what a lock is actually measured
 * in, so a minutes-and-seconds countdown would be a rerender per second for
 * information nobody acts on.
 */
export function formatUnlock(hours: number): string {
  if (hours < 24) return `${Math.max(1, Math.ceil(hours))}h`;
  return `${Math.round(hours / 24)}d`;
}

export function bonusFor(paidCents: number, bonusPct: number): number {
  return Math.round((paidCents * bonusPct) / 100);
}

/**
 * "24 Aug". Only ever called from the client — balances load out of
 * localStorage in an effect, so there is no server pass to disagree with.
 */
export function formatWhen(atMs: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(atMs));
}

/**
 * The opening state. One matured balance with history so the surface is not
 * empty on first load, one mid-lock so the countdown is visible immediately,
 * and one long name so truncation shows up in review rather than production.
 */
export function seedBalances(nowMs: number): CreditBalance[] {
  return [
    {
      id: "bal_lardo",
      placeId: "plc_lardo",
      placeName: "Lardo",
      balanceCents: 124_000,
      paidCents: 110_000,
      maturesAtMs: nowMs - 5 * 24 * HOUR_MS,
      bonusPct: 13,
      activity: [
        {
          id: "a1",
          label: "Dinner",
          amountCents: -48_000,
          atMs: nowMs - 2 * 24 * HOUR_MS,
        },
        {
          id: "a2",
          label: "Bought Credits",
          amountCents: 124_000,
          atMs: nowMs - 6 * 24 * HOUR_MS,
        },
      ],
    },
    {
      id: "bal_tono",
      placeId: "plc_tono",
      placeName: "Restaurante La Casa de Toño Insurgentes",
      balanceCents: 43_200,
      paidCents: 40_000,
      maturesAtMs: nowMs - 3 * 24 * HOUR_MS,
      bonusPct: 8,
      activity: [
        {
          id: "b1",
          label: "Bought Credits",
          amountCents: 43_200,
          atMs: nowMs - 4 * 24 * HOUR_MS,
        },
      ],
    },
    {
      id: "bal_pangea",
      placeId: "plc_pangea",
      placeName: "Pangea",
      balanceCents: 250_000,
      paidCents: 200_000,
      maturesAtMs: nowMs + 18 * HOUR_MS,
      bonusPct: 25,
      activity: [
        {
          id: "c1",
          label: "Bought Credits",
          amountCents: 250_000,
          atMs: nowMs - 54 * HOUR_MS,
        },
      ],
    },
  ];
}
