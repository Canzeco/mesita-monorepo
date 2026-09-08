// Real Credits helpers — the Wallet's balances read from
// consumer-web-list-credit-balances now (MESITA-1674). This replaces the
// useful, non-fake half of the deleted src/lib/mock/credits-mock.ts: the
// policy type and the display-formatting rules. What did NOT survive is the
// fixture (CREDIT_PLACES, seedBalances) and the emulator's own state
// machine (buy/gift/redeem/spend) — those had no real counterpart to become,
// only a browser-only stand-in to delete.

export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

/**
 * The guest-facing slice of app_config.controls_config, as
 * consumer-web-get-controls-config returns it — mirrors
 * supabase/functions/_shared/controls-config.ts's GuestControlsPolicy.
 */
export type ControlsPolicy = {
  /** Parked: no lot on the buy path applies a hold today (MESITA-1676). Kept for display of any lot that DOES carry one. */
  defaultHoldHours: number;
  defaultBonusPct: number;
  defaultExpiryDays: number;
};

/**
 * Mirrors supabase/functions/_shared/controls-config.ts CONTROLS_DEFAULTS.
 * Used only until the policy fetch lands — if it fails, the Wallet is more
 * useful holding the shipped default than refusing to render.
 */
export const CONTROLS_FALLBACK: ControlsPolicy = {
  defaultHoldHours: 3,
  defaultBonusPct: 5,
  defaultExpiryDays: 90,
};

/** Past its expiry — the only thing that stops a lot being spendable. */
export function isExpired(expiresAtMs: number, nowMs: number): boolean {
  return expiresAtMs <= nowMs;
}

/** Not yet matured — the OTHER thing that stops a lot being spendable. */
export function isPending(activatesAtMs: number, nowMs: number): boolean {
  return activatesAtMs > nowMs;
}

/** Days left before expiry. Negative once it has passed. */
export function daysUntilExpiry(expiresAtMs: number, nowMs: number): number {
  return (expiresAtMs - nowMs) / DAY_MS;
}

/** Hours left before activation. Negative once it has matured. */
export function hoursUntilActivation(activatesAtMs: number, nowMs: number): number {
  return (activatesAtMs - nowMs) / HOUR_MS;
}

/**
 * "89d" out at range, "6d", then "Today" on the last one. Rounds DOWN:
 * overstating an expiry costs a guest the money.
 */
export function formatExpiry(days: number): string {
  if (days <= 0) return "Expired";
  const whole = Math.floor(days);
  return whole < 1 ? "Today" : `${whole}d`;
}

/**
 * "3h", then "Soon" once it is inside the hour — the mirror of
 * formatExpiry, rounding the OTHER way: understating a wait a guest is still
 * inside costs nothing, but a countdown that reads "0h" while still pending
 * looks broken.
 */
export function formatActivation(hours: number): string {
  if (hours <= 0) return "Now";
  const whole = Math.ceil(hours);
  return whole < 1 ? "Soon" : `${whole}h`;
}

/** "24 Aug". Client-only: every balance loads from an EF call in an effect. */
export function formatWhen(atMs: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(atMs));
}

// ── The three states a real, org-scoped balance can be in ──────────────────
// Credits used to open in exactly two — Available and Expired — because the
// buy path never applied the hold it still carries in the schema (BalanceClient
// once said so outright). This read surfaces PENDING lots too (any writer
// other than the buy path can still produce one), so the card needs the
// third state back.

export type OrgBalanceState = "spendable" | "pending" | "expired";

export function orgBalanceState(
  o: { spendableCents: number; pendingCents: number },
): OrgBalanceState {
  if (o.spendableCents > 0) return "spendable";
  if (o.pendingCents > 0) return "pending";
  return "expired";
}

/**
 * The one number a card leads with: what's usable now, else what's on its
 * way, else — for a balance that is only ever dead money — what was there.
 * Never zero while totalCents is positive, so a fully expired org still
 * shows the guest what they had rather than reading as an empty balance.
 */
export function headlineCents(
  o: { spendableCents: number; pendingCents: number; totalCents: number },
): number {
  if (o.spendableCents > 0) return o.spendableCents;
  if (o.pendingCents > 0) return o.pendingCents;
  return o.totalCents;
}
