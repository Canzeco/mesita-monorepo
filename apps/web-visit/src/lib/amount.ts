/** "1,234.50" as whole cents, or null. On the digits, so no float touches it. */
export function readAmount(text: string): number | null {
  const clean = text.replace(/[,\s]/g, "");
  const m = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(clean);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? "").padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

/** "$200 MXN": the code always shows, as in Mesita Business. */
export function money(cents: number, currency: string): string {
  const amount = (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol",
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  });
  return `${amount} ${currency}`;
}
