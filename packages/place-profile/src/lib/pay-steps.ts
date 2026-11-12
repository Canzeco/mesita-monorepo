// THE SIX PAY STEPS AND THE WORD "SIGN" (MESITA-3759). One guest payment is
// six named steps, the same on every screen and on both phones:
//
//   1 Pick · 2 Bill · 3 Tip · 4 Methods · 5 Pay · 6 Sign
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
// it from @mesita/place-profile/lib/pay-steps. web-consumer draws the strip
// (PaySteps); the waiter's phone and the owner's console use labels only.

export const PAY_STEPS = [
  { key: "pick", name: "Pick" },
  { key: "bill", name: "Bill" },
  { key: "tip", name: "Tip" },
  { key: "methods", name: "Methods" },
  { key: "pay", name: "Pay" },
  { key: "sign", name: "Sign" },
] as const;

export type PayStepKey = (typeof PAY_STEPS)[number]["key"];
/** Whose phone: the guest never signs, so step 6 names the waiter there. */
export type PayAudience = "guest" | "waiter";

/** 1-based: Pick is 1, Sign is 6. */
export function payStepNumber(key: PayStepKey): number {
  return PAY_STEPS.findIndex((s) => s.key === key) + 1;
}

/** The step's name as that phone reads it. Three stated exceptions to the
 *  bare name: the guest's list heading "Pick a place", the guest's step 6
 *  "Waiter signs" (never an instruction to the guest), the waiter's "Sign". */
export function payStepName(key: PayStepKey, audience: PayAudience = "guest"): string {
  if (audience === "guest" && key === "pick") return "Pick a place";
  if (audience === "guest" && key === "sign") return "Waiter signs";
  return PAY_STEPS[payStepNumber(key) - 1].name;
}

/** The heading: "2 · Bill" on the guest's phone; the waiter saw no other
 *  step, so theirs has no number ("Sign"). */
export function payStepLabel(key: PayStepKey, audience: PayAudience = "guest"): string {
  const name = payStepName(key, audience);
  return audience === "waiter" ? name : `${payStepNumber(key)} · ${name}`;
}

/** What a screen reader hears for the strip: "Step 2 of 6: Bill". */
export function payStepSpoken(key: PayStepKey): string {
  return `Step ${payStepNumber(key)} of ${PAY_STEPS.length}: ${payStepName(key, "guest")}`;
}

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
  notSignedNoCashback: "Not signed · no cashback",
  waiterDidntSign: (cash: string) => `The waiter didn't sign · no cashback on the ${cash} cash`,
  creditsOnceSigned: (credits: string) => `${credits} in credits once signed`,
  showWaiterBy: (time: string) => `Show the waiter by ${time}`,
  alreadySigned: "The waiter already signed this payment.",
  // Waiter
  meaning: "Signing says you attended this payment.",
  signing: "Signing…",
  signedAt: (time: string) => `Signed · ${time}`,
  alreadySignedAt: (time: string) => `Already signed · ${time}`,
  signedElsewhereAt: (time: string) => `Signed by another phone at ${time}`,
  tapSignAgain: "Couldn't reach Mesita. Tap Sign again.",
  shortOrSignFor: (missing: string, received: string) =>
    `${missing} short. Ask for ${missing} more, or sign for ${received} received.`,
  couldntSign: "Couldn't sign. Try again.",
  // Owner
  ownerSigned: (when: string, phone: string | null) => ` · Signed ${when}${phone ? ` · phone ${phone}` : ""}`,
  ownerNotSigned: " · Not signed",
  ownerCheckPhone: "Check this phone: the only payment it signed here was cash. If you don't know it, change the waiter code.",
} as const;
