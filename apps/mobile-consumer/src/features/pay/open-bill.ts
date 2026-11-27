import type { GuestBill } from "./visit";

/** "Bill to review · 4:12 left" or "Pay at the place · 4:12 left". */
export function pendingLine(bill: GuestBill, now: number): string {
  const secs = Math.max(0, Math.ceil((Date.parse(bill.expiresAt) - now) / 1000));
  const left = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")} left`;
  return `${bill.state === "sent" ? "Bill to review" : "Pay at the place"} · ${left}`;
}
