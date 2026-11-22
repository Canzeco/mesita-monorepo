// Business › Views analytics (MESITA-4675). Pure: synthesized from the raw
// view events on every load, never stored (Rules › Analytics: raw events in,
// numbers computed by the Edge Function when the page loads).

export type ViewEventRow = { consumer_id: string | null; kind: string; created_at: string };

export type ViewsAnalytics = {
  /** Every open, all time. */
  views: number;
  /** Distinct guests who opened it, all time. */
  viewers: number;
  /** Guests who opened it on two or more different days. */
  returning: number;
  views7d: number;
  views30d: number;
  viewers30d: number;
};

const DAY_MS = 86_400_000;

export function synthesizeViews(rows: ViewEventRow[], now: number): ViewsAnalytics {
  const since7 = now - 7 * DAY_MS;
  const since30 = now - 30 * DAY_MS;
  const days = new Map<string, Set<string>>();
  const viewers30 = new Set<string>();
  let views = 0;
  let views7d = 0;
  let views30d = 0;

  for (const r of rows) {
    if (r.kind !== "viewed") continue;
    views++;
    const at = Date.parse(r.created_at);
    if (at >= since7) views7d++;
    if (at >= since30) {
      views30d++;
      if (r.consumer_id) viewers30.add(r.consumer_id);
    }
    if (!r.consumer_id) continue;
    let d = days.get(r.consumer_id);
    if (!d) days.set(r.consumer_id, (d = new Set()));
    d.add(r.created_at.slice(0, 10));
  }

  let returning = 0;
  for (const d of days.values()) if (d.size > 1) returning++;

  return { views, viewers: days.size, returning, views7d, views30d, viewers30d: viewers30.size };
}
