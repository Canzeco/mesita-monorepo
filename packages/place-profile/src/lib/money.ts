/** Guest-facing currency when a place row doesn't stamp one. */
export const DEFAULT_CURRENCY = "MXN";

// ── Amounts a person types and reads (MESITA-3304) ──────────────────────────
// The Pay tab (web-consumer) and the proof page (web-visit) share these, so
// the two screens never disagree on a peso. Typed amounts are read on the
// digits: no float ever touches a cent.

/** "1,234.50" as whole cents, or null (empty, zero, more than two decimals,
 *  anything not a number). */
export function readAmount(text: string): number | null {
  const clean = text.replace(/[,\s]/g, "");
  const m = /^(\d{1,7})(?:\.(\d{0,2}))?$/.exec(clean);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

/** Whole cents as the amount field shows them: "1250" or "1250.50". */
export function amountText(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}

/** "MX$500" or "MX$170.50": whole amounts drop the cents. */
export function moneyLabel(cents: number, currency: string): string {
  const code = currency.toUpperCase();
  const whole = cents % 100 === 0;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: code,
      minimumFractionDigits: whole ? 0 : 2,
      maximumFractionDigits: whole ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(whole ? 0 : 2)} ${code}`;
  }
}

/** The device's local time, 24-hour: "12:04" today, "7 Nov · 12:04" on any
 *  other day. Both apps print "Paid · …" and "Seen · …" with it. */
export function clockTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const sameDay = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  if (sameDay) return hm;
  const day = d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return `${day} · ${hm}`;
}
