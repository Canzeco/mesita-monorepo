// THE WORD "SIGN" (MESITA-3759). The guest's steps are Pick · Bill · Tip ·
// Method · Pay · Sign · Receipt; their list and bar live in web-consumer
// (lib/guest-pay-stages.ts, pay-flow.tsx, MESITA-4226). MESITA-4305 removed
// the older seven-step list (Methods, Total) that nothing drew any more.
//
// Pato, 2026-11-11: "call the last step Sign, where the waiter signs. Sign
// that he attended that transaction."
//
// SIGN IS THE LABEL; `verif*` IS THE WIRE NAME. Columns, functions, refusal
// codes, JSON fields, the checklist key "verified" and data attributes all
// keep "verif". Do not rename the wire: change a word here and every screen
// follows. Every label is a whole string or a small function, never a verb
// fragment, so each sentence reads right.
//
// A plain module (no React): web-consumer, web-visit and web-business import
// it from @mesita/place-profile/lib/pay-steps.

/** The waiter's button: the action, never the total. */
export function signLabel(cashCents: number, money: (cents: number) => string): string {
  return cashCents > 0 ? `Sign · collect ${money(cashCents)}` : "Sign · paid in the app";
}

/** Every Sign label, whole. Signed means a phone at the place confirmed the
 *  payment (the owner's row shows the phone); no screen names a person. */
export const SIGN = {
  // Both phones
  signed: "Signed",
  waiterSigned: "Waiter signed",
  // Guest
  paidSigned: "Paid · Signed",
  // Credit chosen with cash: kept aside, then spent at the signature or
  // when the payment closes unsigned (a cancel gives it back) (MESITA-3772).
  creditSpentWhenSignedOrClosed: "Spent when the waiter signs or the payment closes",
  notSignedClosed: "Not signed",
  waiterDidntSign: (cash: string) => `The waiter didn't sign the ${cash} cash`,
  creditsOnceSigned: (credits: string) => `${credits} in credits once signed`,
  showWaiterBy: (time: string) => `Show the waiter by ${time}`,
  alreadySigned: "The waiter already signed this payment.",
  // Waiter
  signing: "Signing…",
  signedAt: (time: string) => `Signed · ${time}`,
  alreadySignedAt: (time: string) => `Already signed · ${time}`,
  signedElsewhereAt: (time: string) => `Signed by another phone at ${time}`,
  tapSignAgain: "Couldn't reach Mesita. Tap Sign again.",
  couldntSign: "Couldn't sign. Try again.",
  // The cash question: a yes or no, never a typed amount (MESITA-3799).
  cashQuestion: (cash: string) => `Did you get ${cash} in cash?`,
  cashYes: "Yes",
  cashNo: "No",
  cashNotReceived: "Don't sign yet. Collect the cash first, or the guest can cancel.",
  // The waiter code, typed for every signature (MESITA-3799).
  waiterCode: "Waiter code",
  wrongWaiterCode: "That waiter code is not right.",
  tryAgainInMin: (min: number) => `Try again in ${min} min.`,
  // Owner
  ownerSigned: (when: string, phone: string | null) => ` · Signed ${when}${phone ? ` · phone ${phone}` : ""}`,
  ownerNotSigned: " · Not signed",
  ownerCheckPhone: "Check this phone: the only payment it signed here was cash. If you don't know it, change the waiter code.",
} as const;
