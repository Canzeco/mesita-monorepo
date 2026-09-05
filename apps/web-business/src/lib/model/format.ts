// Peso formatting for the console. Cents in, "$1,234" out (MXN, no
// decimals — menu prices are whole pesos everywhere in the product).
export function formatMxn(cents: number): string {
  return `$${Math.round(cents / 100).toLocaleString("en-US")}`;
}
