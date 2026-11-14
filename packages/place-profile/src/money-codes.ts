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
  // the Mesita Payments switch is off here (MESITA-3396): no card part, no cashback
  "cards_off",
  "welcome_used",
  "place_code_required",
  // The place's outstanding credit across guests would pass its Credits
  // Limit after this buy (MESITA-3947; the MESITA-3305 test-mode cap before)
  "place_cap",
  // The amount
  "below_minimum",
  "amount_required",
  "insufficient",
  "above_cap",
  // The waiter's charge (MESITA-3306): a ticket over 32 characters
  "ticket_too_long",
  // Payments Flow v2 (MESITA-3545): a tip that is not 0 to the cap; an
  // outside bill without the waiter's charge; credit already covers the bill
  // (nothing to pay outside); Received on a bill that is not paying outside
  "tip_invalid",
  "outside_needs_charge",
  "credit_covers",
  "not_outside",
  // The waiter's Received came after the guest cancelled paying the waiter,
  // or after that bill's 30 minutes
  "closed",
  "expired",
  // A guest's outside bills at one place in a rolling day passed the limit
  "outside_limit",
  // The session
  "sign_in",
  "forbidden",
  // visit.mesita.ai's payments list without staff access (MESITA-3462)
  "staff_only",
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
  // Operator refunds (MESITA-3307): Stripe refused one (+stripe_code), or
  // nothing is left to refund on the row
  "refund_failed",
  "nothing_to_refund",
  // A stale Business › Payments tab sent a switch that no longer exists (MESITA-3408)
  "unknown_switch",
  // Why a voucher is not sellable yet
  "not_yet",
  "needs_card_payments",
  "needs_instagram",
  // Story: the guest's Instagram has 1,000 followers or fewer (MESITA-3507)
  "few_followers",
  // Sending credit to a friend (MESITA-3292): live sending waits on the
  // lawyer (money_config.sending_live), ten open links per place, a link is
  // never the sender's own, and a link taken or taken back gives nothing
  "not_live",
  "too_many_open",
  "own_gift",
  "claimed",
  "taken_back",
  // A guest typed too many wrong gift codes this hour (MESITA-3737)
  "too_many_tries",
  // Story and VIP, one each new visit (MESITA-3463): bought for every visit
  "needs_visit",
  // VIP (MESITA-3550): the guest is not of the VIP class
  "not_vip",
  // A basket of several vouchers (MESITA-3841) pays with a saved card only
  "basket_needs_card",
] as const;

export type MoneyCode = (typeof MONEY_CODES)[number];

export function isMoneyCode(v: unknown): v is MoneyCode {
  return typeof v === "string" && (MONEY_CODES as readonly string[]).includes(v);
}
