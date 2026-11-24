// THE GUEST'S PAY STEPS (Pato, 2026-11-23, MESITA-4813: "Yes, cut to three"):
// QR · Bill · Payment · Receipt (MESITA-4889; Payment, the waiter's word, MESITA-4928), drawn by the strip at the bottom of every
// screen of the ticket (MESITA-4600). Pick, the Pay tab's list, is step 0 and
// wears no strip (MESITA-4635). Bill · Method · Pay · Receipt until then.

export const STRIP_STEPS = ["QR", "Bill", "Payment", "Receipt"] as const;
export type StripAt = 1 | 2 | 3 | 4 | "done";
