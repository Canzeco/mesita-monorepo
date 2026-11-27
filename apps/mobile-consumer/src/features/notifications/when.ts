/** "2h", "5m", "3d": the same clock the feed uses. */
export function shortAgo(iso: string, now: number): string {
  const mins = Math.floor(Math.max(0, now - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(mins) || mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}
