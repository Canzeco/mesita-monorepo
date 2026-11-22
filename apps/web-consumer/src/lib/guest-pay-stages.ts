// THE GUEST'S PAY STEPS (MESITA-4226, Pato, 2026-11-17: "remove card. we
// only have one card ... we should have all those steps. but don't mention
// them all ... Receipt only when its done"; eight until then, MESITA-4135,
// with a Card step to pick among saved cards — a guest saves one card since
// MESITA-4168).
//
//   0 Pick · 1 Bill · 2 Tip · 3 Method · 4 Pay · 5 Confirm · 6 Receipt
//
// Pick is the Pay tab's list (never drawn as a current step); Bill and Tip
// share GuestPayScreen's "bill" stage (typing or not); Method picks the way
// (credits, Mesita App with the one card, or outside the app); Pay charges
// the card or says to give the cash; Confirm and Receipt are GuestTabView.
// Credits that cover everything open the bill from Method (Pay not shown).
//
// THE STRIP AT THE BOTTOM (Pato, 2026-11-21, MESITA-4600: "bottom must have
// steps. 1. Show place, 2 …"): four numbered steps, Place · Bill · Tip · Pay,
// on every screen of the ticket; stripStep says which one a screen lights.
//
// Every rule that decides which step shows lives here, React-free, so it is
// tested on its own and the screen never sets state while rendering.

import type { PayWith } from "@/lib/api/tab";
import type { Stage } from "@/lib/guest-pay-draft";

export const STEP = { pick: 0, bill: 1, tip: 2, method: 3, pay: 4, sign: 5, receipt: 6 } as const;

/** Every screen of the ticket, by name (MESITA-4600). */
export type PayScreen =
  | "pick"
  | "bill"
  | "tip"
  | "method"
  | "pay"
  | "cash-due"
  | "confirm"
  | "confirming"
  | "receipt"
  | "not-paid"
  | "off";

/** The bottom strip's five steps (Pato, 2026-11-21, MESITA-4619: "1. Pick 2.
 *  Bill & Tip MERGE THESE TWO into one … 3. Method 4. Pay … 5. Receipt … the
 *  last step must be receipt"). The merged step reads "Bill" (MESITA-4630:
 *  "call the step bill, not bill & tip, even though you are using both in
 *  the same page"). Place · Bill · Tip · Method · Pay under MESITA-4613;
 *  four under MESITA-4600. */
export const STRIP_STEPS = ["Pick", "Bill", "Method", "Pay", "Receipt"] as const;
export type StripAt = 1 | 2 | 3 | 4 | 5 | "done";

/** The step a screen lights: 1 Pick · 2 Bill · 3 Method · 4 Pay; "done"
 *  on the Receipt (all five lit, a check on Receipt); null where no strip
 *  shows (Not paid, Off). */
export function stripStep(screen: PayScreen): StripAt | null {
  switch (screen) {
    case "pick":
      return 1;
    case "bill":
    case "tip":
      return 2;
    case "method":
      return 3;
    case "pay":
    case "cash-due":
    case "confirm":
    case "confirming":
      return 4;
    case "receipt":
      return "done";
    case "not-paid":
    case "off":
      return null;
  }
}

/** What the ✕ does before the waiter's screens (MESITA-4598: the ticket is
 *  gone at once, no question; MESITA-4061: a bill that may already be open
 *  on the server is never thrown away, the ✕ only leaves it). */
export function closeAction(a: { busy: boolean; billOpen: boolean }): "ignore" | "leave-keep" | "discard" {
  if (a.busy) return "ignore";
  if (a.billOpen) return "leave-keep";
  return "discard";
}

/** The stage the screen shows: a stored or live stage that no longer makes
 *  sense goes back to Method, where the guest sees why. Pay needs a way that
 *  is still the one the guest chose (a reload can turn a card choice into
 *  cash when the card minimum changes) and something to pay. A card Pay with
 *  no saved card stays on Pay, whose button is then Add a card. */
export function guardStage(a: { stage: Stage; method: PayWith | null; way: PayWith | null; dueCents: number }): Stage {
  if (a.stage === "pay") {
    if (a.dueCents <= 0 || a.way === null) return "method";
    if (a.method !== null && a.way !== a.method) return "method";
    return "pay";
  }
  return a.stage;
}

/** One step back from a stage ("bill" means Tip; the keypad is the screen's). */
export function payBackStage(stage: Stage): Stage {
  return stage === "pay" ? "method" : "bill";
}

/** The stage a reopened draft starts at. Credits are on by default every
 *  time the bill opens (MESITA-4100), so a draft saved at Pay with credits
 *  off would pay a different split than the guest saw: it starts at Method,
 *  where the switch is. */
export function initialStage(d: { stage: Stage; useCredit: boolean } | null): Stage {
  if (!d) return "bill";
  if (d.stage === "pay" && d.useCredit === false) return "method";
  return d.stage;
}

/** Card refusals that keep the guest on Pay (MESITA-4121): the bill never
 *  opened, nothing is held, and the way out is the card again or cash. */
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
