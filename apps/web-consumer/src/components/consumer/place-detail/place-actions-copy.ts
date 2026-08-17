// Copy shared by the two surfaces that offer Visit · Order · Reserve: the
// pinned place-detail bar (PlaceActionBar) and the deck's Go sheet (GoSheet).
//
// Only the ORDER copy lives here, and deliberately so. The money path is
// already shared as code — useStartVisit owns the create, the two-arm 409
// recovery and the seed — and the rest of what the two surfaces have in common
// is layout, which is supposed to differ (a three-up grid vs. a list of rows).
// What is NOT allowed to differ is the promise made about a parked feature:
// Order has no table, no EF and no type anywhere in the stack, so the only
// thing either surface can offer is this sentence, and it has to be one
// sentence, not two that drifted apart.
export const ORDER_COMING_SOON = {
  title: "Ordering coming soon",
  body: "Soon you'll be able to order from this place without leaving Mesita — it'll land in your Inbox next to your visits.",
} as const;
