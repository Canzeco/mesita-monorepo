/** Money is whole pesos in this prototype. */
export function mx(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}MX$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

/** Parse a typed amount: digits only, empty → 0. */
export function parseAmount(text: string): number {
  const digits = text.replace(/[^0-9]/g, "");
  return digits === "" ? 0 : Number.parseInt(digits, 10);
}

export function pct(amount: number, percent: number): number {
  return Math.round((amount * percent) / 100);
}
