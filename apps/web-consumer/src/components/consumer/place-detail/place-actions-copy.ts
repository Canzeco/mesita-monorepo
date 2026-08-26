// Copy shared by the two surfaces that offer Visit · Order · Reserve: the
// pinned place-detail bar (PlaceActionBar) and the deck's Go sheet (GoSheet).
//
// Only the ORDER copy lives here, and deliberately so. The money path is
// already shared as code — useStartVisit owns the create, the two-arm 409
// recovery and the seed — and the rest of what the two surfaces have in common
// is layout, which is supposed to differ (a three-up grid vs. a list of rows).
// What is NOT allowed to differ is the parked-Order contract: no table, no EF,
// no type, and `orders_config.enabled` defaults false. Both surfaces lock the
// control (visible, not tappable). A coming-soon modal on tap reads as a live
// feature that failed.
export const ORDER_BLOCKED = {
  aria: "Ordering isn't available yet",
  title: "Ordering isn't live on Mesita yet.",
  hint: "Ordering isn't live yet.",
} as const;
