// THE GUEST'S PAY STEPS (Pato, 2026-11-23, MESITA-4813: "Yes, cut to three"):
// QR · Pay Bill · Receipt (MESITA-4878), drawn by the strip at the bottom of every
// screen of the ticket (MESITA-4600). Pick, the Pay tab's list, is step 0 and
// wears no strip (MESITA-4635). Bill · Method · Pay · Receipt until then.

export const STRIP_STEPS = ["QR", "Pay Bill", "Receipt"] as const;
export type StripAt = 1 | 2 | 3 | "done";

/** What the ✕ does before the waiter's screens (MESITA-4598: the ticket is
 *  gone at once, no question; MESITA-4061: a bill that may already be open
 *  on the server is never thrown away, the ✕ only leaves it). */
export function closeAction(a: { busy: boolean; billOpen: boolean }): "ignore" | "leave-keep" | "discard" {
  if (a.busy) return "ignore";
  if (a.billOpen) return "leave-keep";
  return "discard";
}
