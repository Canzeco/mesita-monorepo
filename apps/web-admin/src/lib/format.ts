export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString("en-US", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// Timezone-independent absolute stamp ("2026-06-25 07:36 UTC"). Derived
// purely from the ISO string so it renders identically on server and
// client — safe to show during SSR / first paint without a hydration
// mismatch.
export function formatAbsoluteUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().slice(0, 16).replace("T", " ") + " UTC";
}

/** Date and time in Mexico City, the same on server and client. */
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", { timeZone: "America/Mexico_City", dateStyle: "medium", timeStyle: "short" });
}
