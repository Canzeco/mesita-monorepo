// SPIKE FIXTURE — the seed data behind the /credits emulator.
//
// NOTHING HERE IS LIVE. There is no table, no Edge Function and no type for a
// prepaid balance, and the VENUE side does not exist at all: a place today
// cannot set a bonus, cannot set a lock window, and cannot see what it owes.
// This exists so the surface can be exercised before any of that is built
// (MESITA-1380).
//
// THE HOLD IS NO LONGER INVENTED HERE (Pato, 2026-09-01). The default sits in
// app_config.controls_config, owned by admin console > Configurations >
// Controls, and reaches this surface through consumer-web-get-controls-config.
// A place may still override it — `lockHours: null` means "inherit", which is
// what every place does until someone sets one. Same for `bonusPct`.
//
// THE PLACES ARE REAL (Pato, 2026-09-01). Ids, names and photos are rows from
// public.places, so the card art exercises the real storage bucket and the demo
// looks like the actual catalog. The BALANCES against them are still invented —
// nobody has ever prepaid anything.
//
// BALANCES EXPIRE, AND EXPIRY IS COUNTED IN DAYS (Pato, 2026-09-02). This was
// listed below as undecided; the first half is decided now. `defaultExpiryDays`
// sits in app_config.controls_config beside the hold and rides the same
// consumer-web-get-controls-config call. The clock starts at the TOP-UP, not at
// maturity — a hold the place chose must not buy itself a longer life — and a
// top-up re-dates the whole balance the same way it re-locks it.
//
// What is deliberately UNDECIDED and must not be read out of this fixture:
//   · the exact bonus ladder — the shape (longer lock earns more) is the point,
//     the numbers are invented
//   · who issues the instrument, the place or Mesita
//   · what happens to the REMAINDER when a balance expires — forfeited to the
//     place, or the paid half returned. Expiry stops the money being spendable
//     without answering that, and nothing here should be read as answering it
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
  /** Real epoch ms when what is left expires. Set at buy time, from the top-up. */
  expiresAtMs: number;
  /** The place's own bonus, as a whole percent, resolved at buy time. */
  bonusPct: number;
  /** The place's photo, for the card art. Null renders the ink fallback face. */
  photoUrl: string | null;
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
  /** The place's own bonus. Null inherits `defaultBonusPct` from Controls. */
  bonusPct: number | null;
  /** The place's own hold. Null inherits `defaultHoldHours` from Controls. */
  lockHours: number | null;
  /** The place's own expiry, in DAYS. Null inherits `defaultExpiryDays`. */
  expiryDays: number | null;
  /** `places.photos[0]`. Null renders the ink fallback card face. */
  photoUrl: string | null;
};

const PLACE_IMAGES =
  "https://yjalywfzdelacdzccpgb.supabase.co/storage/v1/object/public/place-images/images";

// Four real rows from public.places. Three INHERIT the hold and the bonus,
// which is what every place does today; Cabaret overrides both, so the ladder
// (a longer hold earns a bigger bonus) is visible on the surface instead of
// only in the pitch. The longest name is kept deliberately so truncation shows
// up in review rather than in production.
export const CREDIT_PLACES: CreditPlace[] = [
  {
    id: "6305de4b-1e59-493b-aba8-690cf109545a",
    name: "Tony's Tacos Valle Oriente",
    bonusPct: null,
    lockHours: null,
    expiryDays: null,
    photoUrl: `${PLACE_IMAGES}/5034ce903fa4fd33e008cc42993834dd8712c787fd0ccaed39d2c6b02cff3027.jpg`,
  },
  {
    id: "d42d20dd-5ef5-477e-b4d5-9fc024327b6f",
    name: "Quincy Punto Valle",
    bonusPct: null,
    lockHours: null,
    expiryDays: null,
    photoUrl: `${PLACE_IMAGES}/3e72356768b0112fa5c7222e4d3797640cc835a1ff0ad7abc2a0801ff389b33f.jpg`,
  },
  {
    id: "d3a10dcc-8988-4b0d-8cd4-8735a27e97d7",
    name: "Dos Amores Brunch & Meal",
    bonusPct: null,
    lockHours: null,
    expiryDays: null,
    photoUrl: `${PLACE_IMAGES}/baec6e6cdee888ae343924d22692bb3e19a025258eedfeb10dafdbaafdffaf03.jpg`,
  },
  {
    id: "e0927a0f-879a-4142-802f-6bbe7e00ed95",
    name: "Cabaret Social Room",
    bonusPct: 25,
    lockHours: 72,
    // The one place that sells a longer life than the policy floor, so the
    // override path is exercised at all rather than only described.
    expiryDays: 180,
    photoUrl: `${PLACE_IMAGES}/c80e201542993104ccfd82c45b7adc1f94810e935c5d688bdd7c97aabfb75fd5.jpg`,
  },
];

/**
 * The guest-facing half of app_config.controls_config, as
 * consumer-web-get-controls-config returns it.
 */
export type ControlsPolicy = {
  defaultHoldHours: number;
  defaultBonusPct: number;
  /** DAYS, where the hold is hours. The two terms are not in the same unit. */
  defaultExpiryDays: number;
};

/**
 * Mirrors supabase/functions/_shared/controls-config.ts CONTROLS_DEFAULTS. Used
 * only until the policy fetch lands, and if the fetch fails — the Wallet is
 * more useful holding for the shipped default than refusing to render.
 */
export const CONTROLS_FALLBACK: ControlsPolicy = {
  defaultHoldHours: 3,
  defaultBonusPct: 5,
  defaultExpiryDays: 90,
};

/** The hold this place actually gets. Null on the place means inherit. */
export function holdHoursFor(
  place: CreditPlace,
  policy: ControlsPolicy,
): number {
  return typeof place.lockHours === "number" && Number.isFinite(place.lockHours)
    ? place.lockHours
    : policy.defaultHoldHours;
}

/** The bonus this place actually pays. Null on the place means inherit. */
export function bonusPctFor(
  place: CreditPlace,
  policy: ControlsPolicy,
): number {
  return typeof place.bonusPct === "number" && Number.isFinite(place.bonusPct)
    ? place.bonusPct
    : policy.defaultBonusPct;
}

/**
 * The life this place's Credits get, in DAYS. Null on the place means inherit.
 * No ceiling is applied here for the same reason `holdHoursFor` applies no
 * floor: the operator's guards clamp on the way IN, at
 * _shared/controls-config.ts, and re-clamping a stored term on the way out
 * would silently reprice Credits a guest already bought.
 */
export function expiryDaysFor(
  place: CreditPlace,
  policy: ControlsPolicy,
): number {
  return typeof place.expiryDays === "number" &&
      Number.isFinite(place.expiryDays)
    ? place.expiryDays
    : policy.defaultExpiryDays;
}

export function placeById(id: string): CreditPlace | undefined {
  return CREDIT_PLACES.find((p) => p.id === id);
}

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export function isLocked(b: CreditBalance, nowMs: number): boolean {
  return b.maturesAtMs > nowMs;
}

/**
 * Past its expiry. A separate question from locked: a balance can be both (the
 * degenerate case the config's floor exists to prevent) and the two states say
 * opposite things — not yet, versus never again.
 */
export function isExpired(b: CreditBalance, nowMs: number): boolean {
  return b.expiresAtMs <= nowMs;
}

/** Spendable right now — a locked OR expired balance contributes nothing. */
export function spendableCents(b: CreditBalance, nowMs: number): number {
  return isLocked(b, nowMs) || isExpired(b, nowMs) ? 0 : b.balanceCents;
}

export function hoursUntil(b: CreditBalance, nowMs: number): number {
  return (b.maturesAtMs - nowMs) / HOUR_MS;
}

/** Days left before expiry. Negative once it has passed. */
export function daysUntilExpiry(b: CreditBalance, nowMs: number): number {
  return (b.expiresAtMs - nowMs) / DAY_MS;
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

/**
 * "89d" out at range, "6d", then "Today" on the last one. Rounds DOWN, unlike
 * `formatUnlock`: overstating a lock costs a guest a little patience,
 * overstating an expiry costs them the money.
 */
export function formatExpiry(days: number): string {
  if (days <= 0) return "Expired";
  const whole = Math.floor(days);
  return whole < 1 ? "Today" : `${whole}d`;
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
 * and the longest name in the fixture so truncation shows up in review rather
 * than in production.
 *
 * The mid-lock balance matures against the CONFIGURED hold, so changing the
 * default in the console changes what a fresh wallet opens on — which is the
 * cheapest possible proof that the knob is wired. Every expiry is derived the
 * same way, from the purchase date the activity row already claims plus the
 * configured life, so no seeded balance carries a term the policy would not
 * have given it.
 */
export function seedBalances(
  nowMs: number,
  policy: ControlsPolicy = CONTROLS_FALLBACK,
): CreditBalance[] {
  const [tacos, quincy, , cabaret] = CREDIT_PLACES;
  /** Expiry runs from the TOP-UP, so it is dated off the purchase, not off now. */
  const expiry = (place: CreditPlace, boughtAtMs: number) =>
    boughtAtMs + expiryDaysFor(place, policy) * DAY_MS;
  const tacosBoughtMs = nowMs - 6 * 24 * HOUR_MS;
  const quincyBoughtMs = nowMs - 4 * 24 * HOUR_MS;
  const cabaretBoughtMs = nowMs - 54 * HOUR_MS;
  return [
    {
      id: "bal_tacos",
      placeId: tacos.id,
      placeName: tacos.name,
      balanceCents: 124_000,
      paidCents: 110_000,
      maturesAtMs: nowMs - 5 * 24 * HOUR_MS,
      expiresAtMs: expiry(tacos, tacosBoughtMs),
      bonusPct: bonusPctFor(tacos, policy),
      photoUrl: tacos.photoUrl,
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
          atMs: tacosBoughtMs,
        },
      ],
    },
    {
      id: "bal_quincy",
      placeId: quincy.id,
      placeName: quincy.name,
      balanceCents: 43_200,
      paidCents: 40_000,
      maturesAtMs: nowMs - 3 * 24 * HOUR_MS,
      expiresAtMs: expiry(quincy, quincyBoughtMs),
      bonusPct: bonusPctFor(quincy, policy),
      photoUrl: quincy.photoUrl,
      activity: [
        {
          id: "b1",
          label: "Bought Credits",
          amountCents: 43_200,
          atMs: quincyBoughtMs,
        },
      ],
    },
    {
      id: "bal_cabaret",
      placeId: cabaret.id,
      placeName: cabaret.name,
      balanceCents: 250_000,
      paidCents: 200_000,
      // Half its hold still to run, so the lock chip is on screen on arrival.
      maturesAtMs: nowMs + (holdHoursFor(cabaret, policy) / 2) * HOUR_MS,
      expiresAtMs: expiry(cabaret, cabaretBoughtMs),
      bonusPct: bonusPctFor(cabaret, policy),
      photoUrl: cabaret.photoUrl,
      activity: [
        {
          id: "c1",
          label: "Bought Credits",
          amountCents: 250_000,
          atMs: cabaretBoughtMs,
        },
      ],
    },
  ];
}
