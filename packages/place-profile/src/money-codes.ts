// Money codes (MESITA-3302). ONE source, TWO copies: this file and
// packages/place-profile/src/money-codes.ts are byte-identical; `deno task
// sync-shared` copies, money-twins.test.ts and `sync-shared:check` refuse
// drift. It imports nothing, so it compiles under Deno and under the
// package's TypeScript alike.
//
// Every code a money Edge Function answers with, so the client's copy never
// names one the server stopped sending. The EF contract table in Docs ›
// Credits carries one Codes column per EF; this list is its anchor.

export const MONEY_CODES = [
  // The place or the account
  "no_account",
  "currency_mismatch",
  "paused",
  "not_available",
  // The owner switched Credits off here (MESITA-3396): no voucher sells and
  // no credit is spent at this place
  "credits_off",
  "welcome_used",
  "place_code_required",
  // The amount
  "below_minimum",
  "amount_required",
  "insufficient",
  "above_cap",
  // The session
  "sign_in",
  "forbidden",
  "in_progress",
  "locked",
  "taken",
  "gone",
  // Stripe
  "checkout_failed",
  "bad_signature",
  "not_configured",
  // Why a voucher is not sellable yet
  "not_yet",
  "needs_card_payments",
  "needs_instagram",
] as const;

export type MoneyCode = (typeof MONEY_CODES)[number];

export function isMoneyCode(v: unknown): v is MoneyCode {
  return typeof v === "string" && (MONEY_CODES as readonly string[]).includes(v);
}
