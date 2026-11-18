// The Story waiter page's "posted 12 min ago" (MESITA-4304; from MESITA-4264),
// read against the server's clock.

/** "just now", "12 min ago", "3 h ago". */
export function agoLabel(iso: string, nowIso: string): string {
  const min = Math.floor((Date.parse(nowIso) - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(min) || min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.floor(min / 60)} h ago`;
}
