export function normaliseImageOrder(
  raw: unknown,
  length: number,
): number[] | null {
  if (!Array.isArray(raw)) return null;
  const order: number[] = [];
  const seen = new Set<number>();
  for (const v of raw) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isInteger(n) && n >= 0 && n < length && !seen.has(n)) {
      order.push(n);
      seen.add(n);
    }
  }
  for (let i = 0; i < length; i++) {
    if (!seen.has(i)) order.push(i);
  }
  return order;
}
