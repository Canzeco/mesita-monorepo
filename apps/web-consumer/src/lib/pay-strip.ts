import { SIGN } from "@mesita/place-profile/lib/pay-steps";
import type { GuestTab } from "@/lib/api/tab";

// THE TOP OF THE GUEST'S PAYMENT PAGE (MESITA-3759): one pure function maps
// a guest payment to what /pay/tab/<id> shows above the QR, for every state
// the money can be in. No React here; GuestTabView draws what this says.
//
//   state      strip      heading (the h2)   band (the money's one line)
//   waiting    waiting    the strip's label  Card going through · Paid ·
//                         "6 · Waiter signs" Show this to the waiter
//   signed     signed     the strip's label  Paid · Signed
//                         "Signed"
//   closed     none       the band's line    Paid (in the app, no cash) · Closed
//   refunded   none       the band's line    Refunded · Partly refunded
//   review     none       the band's line    We're checking this payment.
//
// The strip is only for a payment the waiter can still sign or has signed.
// One that closed unsigned (its window ended, or it was cancelled), was
// refunded or is being checked shows no strip, and its status is the page's
// heading. A card payment that already reads Paid still waits at step 6
// until the waiter signs.
//
// `verified_at` is the wire name for "signed" (see pay-steps.ts).

export type PayStripTab = Pick<GuestTab, "status" | "expires_at" | "verified_at" | "cash_bill_cents" | "cash_tip_cents" | "parts">;

export type PayStripState = "waiting" | "signed" | "closed" | "refunded" | "review";

export type PayStrip = {
  state: PayStripState;
  /** The six-step strip: at step 6 while it waits, all solid once signed,
   *  none for a payment that ended any other way. */
  strip: "waiting" | "signed" | null;
  /** With no strip, the status is the page's heading; null with a strip
   *  (the strip's label is the heading). */
  heading: string | null;
  /** The status band's one line: the money's state only. */
  band: string;
  /** The waiter signed (whatever happened to the money afterwards). */
  signed: boolean;
  /** Nothing more can happen at the table: cancelled or past its window. */
  closed: boolean;
  /** The money is in and stays in: the green band. */
  green: boolean;
};

const none = (state: PayStripState, band: string, rest: Pick<PayStrip, "signed" | "closed" | "green">): PayStrip => ({
  state,
  strip: null,
  heading: band,
  band,
  ...rest,
});

export function payStrip(tab: PayStripTab, nowMs: number): PayStrip {
  const signed = !!tab.verified_at;
  const closed = tab.status === "expired" || tab.status === "cancelled" || Date.parse(tab.expires_at) <= nowMs;
  const cash = tab.cash_bill_cents + tab.cash_tip_cents;
  const has = (status: string) => tab.parts.some((p) => p.status === status);

  // Money that is being checked or went back is never green and never signed-looking.
  if (has("needs_review")) return none("review", "We're checking this payment.", { signed, closed, green: false });
  if (has("refunded")) return none("refunded", "Refunded", { signed, closed, green: false });
  if (has("partly_refunded")) return none("refunded", "Partly refunded", { signed, closed, green: false });

  if (signed) return { state: "signed", strip: "signed", heading: null, band: SIGN.paidSigned, signed, closed, green: true };

  // Paid in the app with no cash is Paid at once, signed or not.
  const green = tab.status === "paid" && cash === 0;
  if (closed) return none("closed", green ? "Paid" : "Closed", { signed, closed, green });

  const cardGoing = tab.parts.some((p) => p.part === "card" && (p.status === "open" || p.status === "opening"));
  return {
    state: "waiting",
    strip: "waiting",
    heading: null,
    band: cardGoing ? "Card going through" : green ? "Paid" : "Show this to the waiter",
    signed,
    closed,
    green,
  };
}
