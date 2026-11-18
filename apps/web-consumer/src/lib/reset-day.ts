// The 1st of next month in Mexico City, as "Dec 1": when the monthly
// reservation cap resets. The server counts by the same zone's calendar
// month (supabase _shared/local-time.ts DEFAULT_ZONE, reservationsThisMonth).
// Moved from PlanModal (MESITA-4393) so the reserve flow says the same date.
export function resetDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  return new Date(Date.UTC(y, m, 1, 12)).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
