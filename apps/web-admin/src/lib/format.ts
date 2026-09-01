export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Timezone-independent absolute stamp ("2026-06-25 07:36 UTC"). Derived
// purely from the ISO string so it renders identically on server and
// client — safe to show during SSR / first paint without a hydration
// mismatch. Used as the title tooltip and the pre-mount fallback for
// relative timestamps.
export function formatAbsoluteUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

// Compact relative time ("just now", "5m ago", "3h ago", "2d ago"). Takes
// `nowMs` explicitly so callers can pass a client-only clock and avoid
// hydration mismatches (compute on the server with Date.now() and the two
// renders disagree). Falls back to a short date past a week.
export function timeAgo(iso: string, nowMs: number): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return iso.slice(0, 10);
  const secs = Math.round((nowMs - then) / 1000);
  if (secs < 45) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return formatShortDate(iso);
}

// Compact pesos from cents ("MX$1,250", "MX$12K", "MX$1.2M"). The stat boxes
// on a place page abbreviate past a thousand so each figure stays one line;
// callers that must render an empty state guard for it themselves.
export function formatPesosCompact(cents: number): string {
  const pesos = cents / 100;
  if (pesos >= 1_000_000) return `MX$${(pesos / 1_000_000).toFixed(1)}M`;
  if (pesos >= 1_000) return `MX$${Math.round(pesos / 1_000)}K`;
  return `MX$${Math.round(pesos).toLocaleString()}`;
}
