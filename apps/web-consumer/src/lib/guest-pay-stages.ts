// THE GUEST'S FIVE PAY STEPS (MESITA-4226, Pato, 2026-11-17: "too much
// fucking steps ... remove card. we only have one card ... merge methods for
// them to look shorter"; eight until then, MESITA-4135, with Method and Card
// their own steps).
//
//   0 Pick · 1 Bill · 2 Tip · 3 Pay · 4 Sign · 5 Receipt
//
// Pick is the Pay tab's list (never drawn as a current step); Bill and Tip
// share GuestPayScreen's "bill" stage (typing or not); Pay holds the credits
// switch, the way (Mesita App with the guest's one saved card, or outside the
// app) and the button that opens the bill; Sign and Receipt are GuestTabView.
// No step is ever skipped: every payment walks the same five.
//
// Every rule that decides which step shows lives here, React-free, so it is
// tested on its own.

import type { Stage } from "@/lib/guest-pay-draft";

export const STEP = { pick: 0, bill: 1, tip: 2, pay: 3, sign: 4, receipt: 5 } as const;

/** The stage a reopened draft starts at: a draft saved past Tip opens at
 *  Pay, where the credits switch is (credits are on by default every time
 *  the bill opens, MESITA-4100). */
export function initialStage(d: { stage: Stage } | null): Stage {
  if (!d) return "bill";
  return d.stage === "pay" ? "pay" : "bill";
}

/** Card refusals that keep the guest on Pay (MESITA-4121): the bill never
 *  opened, nothing is held, and the way out is the same card again or
 *  paying outside the app. */
export const PAY_CARD_REFUSALS: ReadonlySet<string> = new Set([
  "card_declined",
  "card_needs_auth",
  "card_failed",
  "card_not_found",
  "locked",
  "below_minimum",
  "card_unavailable",
  "cards_off",
]);

/** Where Not paid's Start again opens (MESITA-4121, MESITA-4226): Pay when
 *  the bill's card failed, the bill expired or the waiter rejected it; Bill
 *  otherwise. */
export function startAgainStage(a: { endReason: string | null; cardFailed: boolean }): Stage {
  switch (a.endReason) {
    case "bank_check_failed":
    case "capture_failed":
    case "hold_released":
    case "card_declined":
    case "card_needs_auth":
    case "expired":
    case "rejected":
      return "pay";
    case null:
    case undefined:
    case "":
      return a.cardFailed ? "pay" : "bill";
    default:
      return "bill";
  }
}
