// THE GUEST'S SEVEN PAY STEPS (MESITA-4117, Pato, 2026-11-15: "THE PAYMENT
// FLOW MUST HAVE 7 STEPS, ONE HIDDEN OPTIONAL: Pick, Bill, Tip, Method, Card,
// Pay, Sign"; Card is the optional one: "if you selected cash or if your
// credits cover all the bill, just skip this step").
//
//   0 Pick · 1 Bill · 2 Tip · 3 Method · 4 Card · 5 Pay · 6 Sign
//
// Pick is the Pay tab's list (never drawn as a current step); Bill and Tip
// share GuestPayScreen's "bill" stage (typing or not); Sign is GuestTabView.
// Card is skipped when the way is cash; Card and Pay are both skipped when
// credits cover everything (Method opens the bill straight away).
//
// Every rule that decides which step shows lives here, React-free, so it is
// tested on its own and the screen never sets state while rendering.

import type { PayWith } from "@/lib/api/tab";
import type { Stage } from "@/lib/guest-pay-draft";

export const STEP = { pick: 0, bill: 1, tip: 2, method: 3, card: 4, pay: 5, sign: 6 } as const;

/** The stage the screen shows: a stored or live stage that no longer makes
 *  sense goes back to Method, where the guest sees why. Card needs the card
 *  way and something to pay; Pay needs a way that is still the one the guest
 *  chose (a reload can turn a card choice into cash when the card minimum
 *  changes) and something to pay; a card Pay with no card resolvable goes to
 *  Card. Credits that cover everything never stop at Card or Pay. */
export function guardStage(a: {
  stage: Stage;
  method: PayWith | null;
  way: PayWith | null;
  dueCents: number;
  /** The saved cards are known and none can be charged. */
  cardMissing: boolean;
}): Stage {
  if (a.stage === "card") {
    return a.way === "card" && a.dueCents > 0 ? "card" : "method";
  }
  if (a.stage === "pay") {
    if (a.dueCents <= 0 || a.way === null) return "method";
    if (a.method !== null && a.way !== a.method) return "method";
    if (a.way === "card" && a.cardMissing) return "card";
    return "pay";
  }
  return a.stage;
}

/** Method's Next: Card for the card way, Pay for cash. */
export function payNextStage(way: PayWith): Stage {
  return way === "card" ? "card" : "pay";
}

/** One step back from a stage ("bill" means Tip; the keypad is the screen's). */
export function payBackStage(stage: Stage, way: PayWith | null): Stage {
  if (stage === "pay") return way === "card" ? "card" : "method";
  if (stage === "card") return "method";
  return "bill";
}

/** The step segments this payment skips, once its way is known: Card for
 *  cash; Card and Pay when credits cover everything. Before the way is known
 *  nothing is skipped. */
export function skippedSegments(a: { way: PayWith | null; creditsOnly: boolean }): number[] {
  if (a.creditsOnly) return [STEP.card, STEP.pay];
  if (a.way === "cash") return [STEP.card];
  return [];
}

/** The same skips read from an opened bill's parts (Sign). */
export function skippedFromParts(parts: ReadonlyArray<{ part: string | null }>): number[] {
  const card = parts.some((p) => p.part === "card");
  const cash = parts.some((p) => p.part === "cash");
  return skippedSegments({ way: card ? "card" : cash ? "cash" : null, creditsOnly: !card && !cash });
}

/** The stage a reopened draft starts at. Credits are on by default every
 *  time the bill opens (MESITA-4100), so a draft saved at Card or Pay with
 *  credits off would pay a different split than the guest saw: it starts at
 *  Method, where the switch is. */
export function initialStage(d: { stage: Stage; useCredit: boolean } | null): Stage {
  if (!d) return "bill";
  if ((d.stage === "card" || d.stage === "pay") && d.useCredit === false) return "method";
  return d.stage;
}
