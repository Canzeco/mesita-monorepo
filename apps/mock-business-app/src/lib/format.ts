// Formatting. Money is an integer of centavos until the moment it is printed.

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

export function money(cents: number): string {
  return MXN.format(cents / 100);
}

/** A compact money string for tiles and chips — "$12.4k" beats "$12,438.00"
 *  in a 96px column, and the exact value is one row away in the list. */
export function moneyShort(cents: number): string {
  const pesos = cents / 100;
  if (pesos >= 1_000_000) return `$${(pesos / 1_000_000).toFixed(1)}M`;
  if (pesos >= 1_000) return `$${(pesos / 1_000).toFixed(1)}k`;
  return `$${pesos.toFixed(0)}`;
}

const DAY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const DAY_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export function day(iso: string): string {
  return DAY.format(new Date(iso));
}

export function dayTime(iso: string): string {
  return DAY_TIME.format(new Date(iso));
}

/** "3 days ago" against the fixture's FIXED now, never against the wall clock
 *  — see MOCK_NOW in mock/fixtures.ts for why. */
export function since(iso: string, now: Date): string {
  const ms = now.getTime() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 0) {
    const ahead = Math.abs(mins);
    if (ahead < 60) return `in ${ahead}m`;
    if (ahead < 1440) return `in ${Math.round(ahead / 60)}h`;
    return `in ${Math.round(ahead / 1440)}d`;
  }
  if (mins < 60) return `${mins}m ago`;
  if (mins < 1440) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 1440)}d ago`;
}

export function stars(n: number): string {
  return "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);
}
