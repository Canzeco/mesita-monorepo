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
  // the Mesita Pay switch is off here (MESITA-3396): no card part, no cashback
  "cards_off",
  "welcome_used",
  "place_code_required",
  // Test mode: the place's outstanding credit across guests would pass the
  // cap after this buy (MESITA-3305, d5a)
  "place_cap",
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
  // The Connect receiver (MESITA-3305): a signature older than its tolerance,
  // a body over the cap, an RPC that failed so Stripe retries
  "stale_event",
  "body_too_large",
  "settle_failed",
  // A stale Business › Payments tab sent a switch that no longer exists (MESITA-3408)
  "unknown_switch",
  // Why a voucher is not sellable yet
  "not_yet",
  "needs_card_payments",
  "needs_instagram",
] as const;

export type MoneyCode = (typeof MONEY_CODES)[number];

export function isMoneyCode(v: unknown): v is MoneyCode {
  return typeof v === "string" && (MONEY_CODES as readonly string[]).includes(v);
}
