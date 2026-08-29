// Copy shared by the two surfaces that offer Visit · Order · Reserve: the
// pinned place-detail bar (PlaceActionBar) and the deck's Go sheet (GoSheet).
//
// Visit is gated on `promoting` (live reward). Order and Reserve use the
// Description → Actions flags from Intaker (`orders_enabled`,
// `reservations_enabled`), with Order also unlocking when a menu is on file.

export const ORDER_BLOCKED = {
  aria: "Ordering isn't available at this place yet",
  title: "This place doesn't have a menu on Mesita yet.",
  hint: "No menu on file yet.",
} as const;

export const RESERVE_BLOCKED = {
  aria: "Reservations aren't typical at this place",
  title: "This kind of place usually doesn't take reservations.",
  hint: "Walk-in spot — no reservation needed.",
} as const;
