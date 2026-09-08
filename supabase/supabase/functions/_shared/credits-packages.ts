// The Buy Credits denomination ladder (MESITA-1676).
//
// ONLY THE BONUS IS GOVERNED, NOT THE DENOMINATIONS. controls_config owns
// `defaultBonusPct` — an operator raising it from 5 to 20 reaches every
// package on this list with no deploy, which is the whole point (Pato's
// 10/15/20 ladder becomes an operator change on the Controls page). The
// AMOUNTS themselves are not a product question this issue answers, so they
// stay a small server-owned constant rather than a second config surface —
// the same three presets apps/web-consumer's mock ladder already shipped
// (PickCredits.tsx AMOUNTS), kept identical on purpose so the real path does
// not visually churn what a demo already showed.
//
// SERVER-OWNED, NEVER CLIENT-SUPPLIED. consumer-web-buy-credits validates the
// client's chosen paidCents against this exact list — an amount that isn't
// here is a 400, not a wire transfer of whatever number showed up.

export const CREDIT_PACKAGE_CENTS: readonly number[] = [50_000, 100_000, 200_000];

export function isCreditPackageAmount(cents: unknown): cents is number {
  return typeof cents === "number" && CREDIT_PACKAGE_CENTS.includes(cents);
}
