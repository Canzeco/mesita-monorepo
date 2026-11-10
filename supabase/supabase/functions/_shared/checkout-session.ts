import { type StripeCall } from "./stripe.ts";
// A one-off Checkout `payment` and what Stripe says about it — shared by the
// Wallet (wallet_purchases, MESITA-3097, on the place's connected account
// since MESITA-3302) and Premier Refill packs (premier_refill_purchases,
// MESITA-3168, on Mesita's own account). Each reads its own purchase's
// session back from Stripe and trusts only that.


export type SessionVerdict =
  | { kind: "paid"; paymentIntent: string | null }
  | { kind: "pending" }
  | { kind: "expired" }
  | { kind: "mismatch" };

/** What a Checkout session says about a purchase. Only `paid` credits; an
 *  open session is left alone; an expired one ends the purchase. A session
 *  whose metadata names another purchase is never trusted, nor (when the
 *  caller says what it expects) one whose amount, currency or mode differ. */
export function classifySession(
  session: Record<string, unknown>,
  purchaseId: string,
  expect?: { amountCents: number; currency: string; livemode: boolean },
  /** Which metadata key names the ledger row: `purchase_id` for a voucher
   *  purchase, `payment_id` for a mixed payment (MESITA-3305). */
  idKey: "purchase_id" | "payment_id" = "purchase_id",
): SessionVerdict {
  const meta = (session.metadata ?? {}) as Record<string, string>;
  if (meta[idKey] !== purchaseId) return { kind: "mismatch" };
  if (
    expect && (
      session.amount_total !== expect.amountCents ||
      String(session.currency ?? "").toLowerCase() !== expect.currency ||
      session.livemode !== expect.livemode
    )
  ) return { kind: "mismatch" };
  if (session.payment_status === "paid") {
    const pi = session.payment_intent;
    const id = typeof pi === "string" ? pi : (pi && typeof pi === "object" ? String((pi as { id?: unknown }).id ?? "") : "");
    return { kind: "paid", paymentIntent: id || null };
  }
  if (session.status === "expired") return { kind: "expired" };
  return { kind: "pending" };
}

/** Reads a purchase's own session from Stripe and classifies it. A session
 *  created on a connected account is read there (`opts.stripeAccount`);
 *  Premier passes none. */
export async function readCheckoutSession(
  stripe: StripeCall,
  sessionId: string,
  purchaseId: string,
  expect?: { amountCents: number; currency: string; livemode: boolean },
  opts?: { stripeAccount?: string; signal?: AbortSignal; idKey?: "purchase_id" | "payment_id" },
): Promise<SessionVerdict> {
  const session = await stripe("GET", `checkout/sessions/${encodeURIComponent(sessionId)}`, undefined, {
    stripeAccount: opts?.stripeAccount,
    signal: opts?.signal,
  });
  return classifySession(session, purchaseId, expect, opts?.idKey ?? "purchase_id");
}
