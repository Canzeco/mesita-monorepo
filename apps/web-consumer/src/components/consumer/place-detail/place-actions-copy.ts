// What the deck's Go sheet (GoSheet) says when a place does not take
// reservations. Reserve is offered unless `reservations_enabled` is explicitly
// false (operator Not or a confirmed walk-in); then the place-detail bar
// (PlaceActionBar) renders nothing and the Go sheet prints this hint.

export const RESERVE_BLOCKED = {
  hint: "Walk-in spot — no reservation needed.",
} as const;
