// Peso formatting for the console. Cents in, "$1,234" out (MXN, no
// decimals — menu prices are whole pesos everywhere in the product).
export function formatMxn(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}

// An organization is Connected when money can actually land AND leave:
// Stripe's `live` is the only state where both are true. pending,
// charges_only and restricted are all "not connected yet" to an operator,
// even though they differ to Stripe — Finances shows which one it is.
export function organizationState(
  paymentAccountState: import("./types").PaymentAccountState,
): import("./types").OrganizationState {
  return paymentAccountState === "live" ? "connected" : "not_connected";
}
