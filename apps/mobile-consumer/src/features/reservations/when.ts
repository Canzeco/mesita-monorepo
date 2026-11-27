/** "Fri Nov 13 · 9:00 PM", on the place's clock. */
export function whenLine(iso: string, tz: string | null): string {
  const at = new Date(iso);
  if (!iso || Number.isNaN(at.getTime())) return "";
  const zone = tz || undefined;
  try {
    const weekday = at.toLocaleDateString("en-US", { weekday: "short", timeZone: zone });
    const monthDay = at.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: zone });
    const time = at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: zone });
    return `${weekday} ${monthDay} · ${time}`;
  } catch {
    return at.toLocaleString();
  }
}
