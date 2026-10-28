// The guest's monthly reservation cap (MESITA-2555).
//
// Every reservation is a real, metered phone call to a place, so one guest
// gets a fixed number of them per calendar month (UTC); cancelled and test
// tickets do not count. The number depends on the guest's Plan
// (consumers.plan: 'free' or 'premium', which every screen labels Pro), and an
// operator can set one guest's own number from Manage › Guests
// (consumers.reservation_cap_override, null = the plan's). Class (Regular/VIP)
// does not enter into it.
// app_config.reservations_config.unlimitedReservations lifts it for testing.
//
// The plan table lives here, not in app_config: Me › Plan prints both numbers
// (web-consumer's plan-perks.ts) and reservation-cap.test.ts pins them to this
// table, so the page can never promise a cap the server does not enforce.
//
// web-consumer's ReservationSheet matches RESERVATION_LIMIT_CODE and prints
// its own copy of RESERVATION_LIMIT_MESSAGE; change the two together.

/** Reservations a month, by stored plan value. */
export const RESERVATION_CAP_BY_PLAN = {
  free: 10,
  premium: 30,
} as const;

export type CapPlan = keyof typeof RESERVATION_CAP_BY_PLAN;

/** Free's cap: what a guest with no plan, or an unknown one, gets. */
export const MONTHLY_RESERVATION_CAP = RESERVATION_CAP_BY_PLAN.free;

/** The operator override's range; the database CHECK holds the same. */
export const RESERVATION_CAP_OVERRIDE_MAX = 1000;

export const RESERVATION_LIMIT_CODE = "reservation_limit_reached";

export const RESERVATION_LIMIT_MESSAGE =
  "You've reached this month's reservation limit.";

/** The plan's cap; anything but 'premium' reads as Free. */
export function planReservationCap(plan: unknown): number {
  return plan === "premium" ? RESERVATION_CAP_BY_PLAN.premium : RESERVATION_CAP_BY_PLAN.free;
}

/** A usable override, or null: an integer 0..RESERVATION_CAP_OVERRIDE_MAX. */
export function readCapOverride(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 &&
      v <= RESERVATION_CAP_OVERRIDE_MAX
    ? v
    : null;
}

/** The cap consumer-web-create-reservation enforces for this guest. */
export function monthlyReservationCap(
  guest: { plan?: unknown; reservation_cap_override?: unknown } | null | undefined,
): number {
  return readCapOverride(guest?.reservation_cap_override) ?? planReservationCap(guest?.plan);
}
