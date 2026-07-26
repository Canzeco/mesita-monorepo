// Adapter: a consumer-web-list-reservations row → the ReservationItem shape
// the parked reservation UI already speaks. Web parity:
// apps/web-consumer/src/lib/reservations-adapter.ts.

import type { EFReservationRow } from '@/lib/api/reservations';
import type {
  ReservationItem,
  ReservationStatus,
} from '@/lib/mock/reservations-mock';

// The card models three visual states. pending = still booking, confirmed =
// booked; every terminal outcome collapses to the muted "cancelled" look.
function toCardStatus(status: EFReservationRow['status']): ReservationStatus {
  if (status === 'pending') return 'booking';
  if (status === 'confirmed') return 'booked';
  return 'cancelled';
}

function noteFor(status: EFReservationRow['status']): string | undefined {
  switch (status) {
    case 'pending':
      return 'Mesita is calling the place to confirm your table.';
    case 'declined':
      return "The place couldn't take this booking.";
    case 'no_show':
      return 'Marked as a no-show.';
    case 'cancelled':
      return 'This reservation was cancelled.';
    default:
      return undefined;
  }
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// Mexico City is UTC-6 year-round (no DST since 2022). We shift the instant by
// the fixed offset and read the UTC parts, so the venue's wall-clock renders
// the same on any device without depending on Hermes Intl timezone support.
export function formatReservationWhen(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return '';
  const mx = new Date(parsed.getTime() - 6 * 60 * 60 * 1000);
  const weekday = WEEKDAYS[mx.getUTCDay()];
  const month = MONTHS[mx.getUTCMonth()];
  const day = mx.getUTCDate();
  let hours = mx.getUTCHours();
  const minutes = mx.getUTCMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  return `${weekday} ${month} ${day} · ${hours}:${minutes} ${ampm}`;
}

export function toReservationItem(row: EFReservationRow): ReservationItem {
  return {
    id: row.id,
    projectId: row.place?.id ?? '',
    placeName: row.place?.name ?? 'Reservation',
    placePhoto: row.place?.photos?.[0] ?? null,
    when: formatReservationWhen(row.reserved_at),
    partySize: row.party_size,
    status: toCardStatus(row.status),
    statusNote: noteFor(row.status),
    // linkedCoupon intentionally omitted: the list EF exposes the coupon by
    // id only, and cross-looking it up is out of scope for MESITA-715.
  };
}
