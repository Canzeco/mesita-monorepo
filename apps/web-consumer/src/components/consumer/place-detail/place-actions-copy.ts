// Copy shared by the two surfaces that offer Credits · Visit · Order · Reserve:
// the pinned place-detail bar (PlaceActionBar) and the deck's Go sheet
// (GoSheet).
//
// Visit is gated on `promoting` (live reward). Order stays locked until the
// order rail ships (MESITA-1155) — menus live on the profile, not here.
// Reserve is offered unless `reservations_enabled` is explicitly false
// (operator Not or a confirmed walk-in). Credits has no gate at all yet.

export const ORDER_BLOCKED = {
  aria: "Ordering isn't available at this place yet",
  title: "Table ordering through Mesita isn't live yet.",
  hint: "View menus on the place profile; ordering is coming.",
} as const;

export const RESERVE_BLOCKED = {
  aria: "Reservations aren't typical at this place",
  title: "This kind of place usually doesn't take reservations.",
  hint: "Walk-in spot — no reservation needed.",
} as const;

// CREDITS IS LOCKED AT EVERY PLACE, and unlike the other two that is a
// statement about Mesita, not about the place. The Credits engine does not
// exist: balances are parked on a browser emulator (no table, no Edge
// Function, no place side), and `places.credits_enabled` is an acceptance
// INTENT bit the future engine will AND with `visits_config.payCredits` — it
// is not a switch that can light this button today. So there is deliberately
// no `isCreditsActionEnabled`: a gate that reads a flag which cannot mean
// "yes" yet would be a knob over an unbuilt engine, and the first place whose
// operator ticked the box would get an enabled button onto a dead end.
//
// The slot still renders, on Order's precedent — a visible locked slot says
// "Mesita will do this here", where hiding it says "this place is missing
// something". The copy carries the parked claim so the lock isn't read as a
// place failing.
export const CREDITS_BLOCKED = {
  aria: "Mesita Credits aren't live yet",
  title: "Paying with Mesita Credits is coming soon.",
  hint: "Coming soon — top up and spend at the table.",
} as const;
