// THE WORD "CONFIRM" (MESITA-4521; "Sign" from MESITA-3759 until then). The
// guest's steps are Pick · Bill · Tip · Method · Pay · Confirm · Receipt; their list and bar live in web-consumer
// (lib/guest-pay-stages.ts, pay-flow.tsx, MESITA-4226). MESITA-4305 removed
// the older seven-step list (Methods, Total) that nothing drew any more.
//
// Pato, 2026-11-21: "the step is not called Sign ... Confirm". The waiter
// types the 4-digit waiter code and taps Confirm.
//
// CONFIRM IS THE LABEL; the `SIGN` / `sign*` identifiers stay as they are; `verif*` IS THE WIRE NAME. Columns, functions, refusal
// codes, JSON fields, the checklist key "verified" and data attributes all
// keep "verif". Do not rename the wire: change a word here and every screen
// follows. Every label is a whole string or a small function, never a verb
// fragment, so each sentence reads right.
//
// A plain module (no React): web-consumer, web-visit and web-business import
// it from @mesita/place-profile/lib/pay-steps.

/** The waiter's button: the action, never the total. */
export function signLabel(cashCents: number, money: (cents: number) => string): string {
  return cashCents > 0 ? `Confirm · collect ${money(cashCents)}` : "Confirm · paid in the app";
}

/** Every Confirm label, whole. Confirmed means a phone at the place confirmed the
 *  payment (the owner's row shows the phone); no screen names a person. */
export const SIGN = {
  // Both phones
  signed: "Confirmed",
  waiterSigned: "Waiter confirmed",
  // Guest
  paidSigned: "Paid · Confirmed",
  // Credit chosen with cash: kept aside, then spent at the signature or
  // when the payment closes unsigned (a cancel gives it back) (MESITA-3772).
  creditSpentWhenSignedOrClosed: "Spent when the waiter confirms or the payment closes",
  notSignedClosed: "Not confirmed",
  waiterDidntSign: (cash: string) => `The waiter didn't confirm the ${cash} cash`,
  creditsOnceSigned: (credits: string) => `${credits} in credits once confirmed`,
  showWaiterBy: (time: string) => `Show the waiter by ${time}`,
  alreadySigned: "The waiter already confirmed this payment.",
  // Waiter
  signing: "Confirming…",
  signedAt: (time: string) => `Confirmed · ${time}`,
  alreadySignedAt: (time: string) => `Already confirmed · ${time}`,
  signedElsewhereAt: (time: string) => `Confirmed by another phone at ${time}`,
  tapSignAgain: "Couldn't reach Mesita. Tap Confirm again.",
  couldntSign: "Couldn't confirm. Try again.",
  // The cash question: a yes or no, never a typed amount (MESITA-3799).
  cashQuestion: (cash: string) => `Did you get ${cash} in cash?`,
  cashYes: "Yes",
  cashNo: "No",
  cashNotReceived: "Don't confirm yet. Collect the cash first, or the guest can cancel.",
  // The 4-digit waiter code, typed for every Confirm (MESITA-3799, MESITA-4521).
  waiterCode: "Waiter code",
  wrongWaiterCode: "That waiter code is not right.",
  tryAgainInMin: (min: number) => `Try again in ${min} min.`,
  // Owner
  ownerSigned: (when: string, phone: string | null) => ` · Confirmed ${when}${phone ? ` · phone ${phone}` : ""}`,
  ownerNotSigned: " · Not confirmed",
  ownerCheckPhone: "Check this phone: the only payment it confirmed here was cash. If you don't know it, change the waiter code.",
} as const;
