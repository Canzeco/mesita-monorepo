/** Which Pay code screen is on, from the server's bill. The screen never works a total out. */

export type BillTyping = { billCents: number; tipCents: number; step: "bill" | "tip" | "code" };

export type BillQuote = {
  outsideCents: number;
  discountBps: number;
  discountCents: number;
  creditCents: number;
  cashbackBps: number;
  cashbackCents: number;
  cashbackCapped?: boolean;
};

export type GuestBill = {
  id: string;
  state: string;
  version: number;
  currency: string;
  billCents: number | null;
  tipCents: number;
  expiresAt: string;
  attemptId: string | null;
  waiterReady: boolean;
  tookCents: number | null;
  place: { id: string | null; name: string | null; photo: string | null };
  quote: BillQuote | null;
};

export type CodePhase = "closed" | "writing" | "qr" | "over" | "confirming" | "paid" | "accepted" | "sent";

export function needsGuest(bill: GuestBill | null): bill is GuestBill {
  return !!bill && (bill.state === "sent" || bill.state === "accepted" || bill.state === "confirming");
}

export function codePhase(input: {
  closed: boolean;
  bill: GuestBill | null;
  typing: BillTyping | null;
  showQr: boolean;
  hideWriting: boolean;
}): CodePhase {
  const { bill, typing } = input;
  const rescan = input.showQr && bill?.state === "accepted";
  if (input.closed && !needsGuest(bill)) return "closed";
  const writing = !rescan && (!bill || bill.state === "open") && !input.hideWriting && typing !== null;
  if (writing) return "writing";
  if (!bill || bill.state === "open" || rescan) return "qr";
  if (bill.state === "cancelled" || bill.state === "expired" || bill.state === "declined" || !bill.quote) return "over";
  if (bill.state === "confirming") return "confirming";
  if (bill.state === "paid") return "paid";
  if (bill.state === "accepted") return "accepted";
  return "sent";
}

/** A failed re-read hides the payable total. It does not answer the bill. */
export function hidePayable(misses: number): boolean {
  return misses >= 2;
}

export function connectionLine(bill: GuestBill | null): string {
  if (bill?.state === "accepted" || bill?.state === "confirming" || bill?.waiterReady) {
    return "Checking… Don't pay again. Ask your waiter if it went through.";
  }
  return "No connection. If it stays, pay normally: nothing was used.";
}

export function clock(expiresAt: string, now: number): string {
  const secs = Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000));
  if (!Number.isFinite(secs)) return "0:00";
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}
