// An organization is Connected when money can actually land AND leave:
// Stripe's `live` is the only state where both are true. pending,
// charges_only and restricted are all "not connected yet" to an operator,
// even though they differ to Stripe — Finances shows which one it is.
export function organizationState(
  paymentAccountState: import("./types").PaymentAccountState,
): import("./types").OrganizationState {
  return paymentAccountState === "live" ? "connected" : "not_connected";
}
