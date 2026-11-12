import type { GuestTab, GuestVisit } from "@/lib/api/tab";
import { payStrip, type PayStripTab } from "@/lib/pay-strip";

// ONE OPEN PAYMENT AT A TIME (MESITA-3772). A guest has at most one open
// payment of their own, across every place. Open means: the guest paid it
// themselves, the waiter has not signed it, it is paying or paid, and its
// window is not over. While one is open the Pay tab shows only that payment,
// and a second Pay is refused. These pure functions decide it; no React here.
//
// An open payment ends one of three ways: the waiter signs it, the guest
// cancels it (nothing moved yet: the credit comes back), or the guest closes
// it (money moved and it is not signed: it ends now and earns no cashback).

/** A list row is the guest's open payment. */
export function isOpenGuestVisit(v: Pick<GuestVisit, "origin" | "verified_at" | "status" | "expires_at">, nowMs: number): boolean {
  return (
    v.origin === "guest" &&
    !v.verified_at &&
    (v.status === "paying" || v.status === "paid") &&
    Date.parse(v.expires_at) > nowMs
  );
}

/** The guest's open payment among their visits, newest first; null for none.
 *  A row from an older server with no `origin` is never open here (the
 *  device's own list still finds it). */
export function pickOpenGuestPayment<V extends Pick<GuestVisit, "origin" | "verified_at" | "status" | "expires_at" | "created_at">>(
  visits: readonly V[],
  nowMs: number,
): V | null {
  let best: V | null = null;
  for (const v of visits) {
    if (!isOpenGuestVisit(v, nowMs)) continue;
    if (!best || Date.parse(v.created_at) > Date.parse(best.created_at)) best = v;
  }
  return best;
}

export type EndTab = PayStripTab & Pick<GuestTab, "status">;

/** The bottom button of the payment's page: "cancel" while nothing has moved
 *  (the credit comes back), "close" once money moved and the waiter has not
 *  signed (it ends now with no cashback), none once it is signed, over,
 *  refunded, being checked, or while a card is still going through. */
export function endAction(tab: EndTab, nowMs: number): "cancel" | "close" | null {
  const top = payStrip(tab, nowMs);
  if (top.state !== "waiting") return null;
  const cardPending = tab.parts.some((p) => p.part === "card" && (p.status === "open" || p.status === "opening"));
  if (cardPending) return null;
  const moved = tab.status === "paid" || tab.parts.some((p) => !!p.paid_at);
  if (moved) return "close";
  return tab.status === "paying" ? "cancel" : null;
}

/** The Pay tab's card for an open payment: a card still going through, or
 *  waiting on the waiter (to take the cash, or to sign). */
export function inProgressLabel(tab: Pick<GuestTab, "parts">): "Card going through" | "Waiting for the waiter" {
  const cardGoing = tab.parts.some((p) => p.part === "card" && (p.status === "open" || p.status === "opening"));
  return cardGoing ? "Card going through" : "Waiting for the waiter";
}
