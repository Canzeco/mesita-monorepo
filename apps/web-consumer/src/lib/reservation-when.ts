import { placeDateTime } from "@mesita/place-profile/lib/place-time";
import type { EFReservationRow } from "@/lib/api/reservations";
import { toReservationItem } from "@/lib/reservations-adapter";
import { stateMeta } from "@/lib/reservation-state";

// How a guest's reservation reads in one line: the Reserve page's list
// (MESITA-3609) and the place screen's button (MESITA-3640) share it.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** "Fri 13 Nov · 21:00", on the place's clock (`tz`, the place's zone). */
export function whenLine(iso: string, tz: string | null): string {
  const t = placeDateTime(iso, tz);
  if (!t) return "";
  const [y, m, d] = t.date.split("-").map(Number);
  const day = new Date(Date.UTC(y, m - 1, d));
  return `${WEEKDAYS[day.getUTCDay()]} ${d} ${MONTHS[m - 1]} · ${t.time}`;
}

/** "Booking…" while Mesita calls, else the state's own label. */
export function statusLabel(row: EFReservationRow): string {
  const phase = toReservationItem(row).state;
  return phase === "booking" ? "Booking…" : stateMeta(phase).label;
}
