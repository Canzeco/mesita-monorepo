// Does a new place take reservations? (MESITA-3623, Pato: "lots of
// businesses don't have reservations ... be realistic about it.")
//
// Create seeds place_profiles.reservations_enabled from this; the operator
// owns it afterwards. Most places are walk-in, so the rule leans OFF:
//   1. Google's own `reservable` answer, when it gives one.
//   2. An OpenTable or Resy link on the listing: on.
//   3. The Create door model's `reservations_likely`, explicit true only.
//   4. Anything else (no answer, junk): off. Before MESITA-3623 a miss meant
//      on (MESITA-1799), which put Reserve on taquerías.

/** The model said an explicit true; anything else is walk-in. */
export function reservationsLikelyFromInference(
  parsed: { reservations_likely?: unknown } | null | undefined,
): boolean {
  return parsed?.reservations_likely === true;
}

export type ReservationEvidence = {
  /** Google Places `reservable`: true, false, or null when unsaid. */
  googleReservable?: boolean | null;
  /** A booking-platform link on the listing (OpenTable, Resy). */
  bookingUrl?: string | null;
  /** The door model's read, or null when it did not run or failed. */
  modelSaysLikely?: boolean | null;
};

/** The Create seed for reservations_enabled, in the order above. */
export function decideReservations(e: ReservationEvidence): boolean {
  if (typeof e.googleReservable === "boolean") return e.googleReservable;
  if (e.bookingUrl?.trim()) return true;
  return e.modelSaysLikely === true;
}

/** The prompt rule the door model answers `reservations_likely` by. */
export const RESERVATIONS_RULE =
  "RESERVATIONS: reservations_likely says whether a guest can realistically " +
  "book a table here ahead of time. Most places can NOT: answer false for " +
  "taquerías, taco stands, street food, food trucks, fast food and chains " +
  "with counter service, cafés, coffee shops, bakeries, ice cream, juice " +
  "and snack bars, cantinas and bars without table service, food courts, " +
  "markets, buffets, takeout or delivery kitchens, and any place under " +
  "price level 2 unless the signals clearly show sit-down table service " +
  "that takes bookings. Answer true only for sit-down, table-service " +
  "places where booking ahead is normal: full-service and upscale " +
  "restaurants, tasting menus, steakhouses, wine bars and clubs with table " +
  "or bottle service, brunch spots known for waits. When unsure, false.";
