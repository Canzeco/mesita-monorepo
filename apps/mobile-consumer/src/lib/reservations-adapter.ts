// Adapter: a consumer-web-list-reservations row → the ReservationItem shape
// the parked reservation UI already speaks. Web parity:
// apps/web-consumer/src/lib/reservations-adapter.ts.

import type { EFReservationRow } from '@/lib/api/reservations';
import type {
  ReservationItem,
  ReservationStatus,
} from '@/lib/mock/reservations-mock';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

// The card models three visual states. pending = still booking, confirmed =
// booked; every terminal outcome collapses to the muted "cancelled" look.
function toCardStatus(status: EFReservationRow['status']): ReservationStatus {
  if (status === 'pending') return 'booking';
  if (status === 'confirmed') return 'booked';
  return 'cancelled';
}

function formatNextAttempt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
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

function noteFor(
  row: EFReservationRow,
  counterOffer: boolean,
): string | undefined {
  if (counterOffer) {
    return 'The place offered other times — pick one below, or reschedule.';
  }
  switch (row.status) {
    case 'pending':
      // MESITA-954 — honest copy while leg 1 is parked waiting for hours.
      if (row.attempts_state === 'scheduled') {
        const when = formatNextAttempt(row.next_attempt_at);
        return when
          ? `Mesita will call the place when it opens — next try ${when}.`
          : "Mesita will call the place when it opens — you'll see the answer here.";
      }
      if (row.attempts_state === 'exhausted') {
        return "The place didn't answer Mesita's calls. Try again or pick another time.";
      }
      if (row.attempts_state === 'running' || (row.call_attempts ?? 0) > 0) {
        return "Mesita is on the phone with the place — you'll see the answer here.";
      }
      return 'Mesita is about to call the place to book your table.';
    case 'declined':
      return "The place couldn't take this booking.";
    case 'unreachable':
      return "The place didn't answer Mesita's calls.";
    case 'no_show':
      return 'Marked as a no-show.';
    case 'cancelled':
      return 'This reservation was cancelled.';
    default:
      return undefined;
  }
}

// Mexico City is UTC-6 year-round (no DST since 2022). We shift the instant by
// the fixed offset and read the UTC parts, so the place's wall-clock renders
// the same on any device without depending on Hermes Intl timezone support.
function formatReservationWhen(iso: string): string {
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

function normalizeClientAlternatives(
  raw: EFReservationRow['alternatives'],
): ReservationItem['alternatives'] {
  if (!Array.isArray(raw)) return undefined;
  const out: NonNullable<ReservationItem['alternatives']> = [];
  for (const item of raw.slice(0, 8)) {
    if (typeof item === 'string') {
      const t = /\b([01]?\d|2[0-3]):([0-5]\d)\b/.exec(item);
      out.push(
        t
          ? { time: `${t[1].padStart(2, '0')}:${t[2]}`, note: item.trim() }
          : { time: '', note: item.trim() },
      );
      continue;
    }
    if (item && typeof item === 'object') {
      const time = typeof item.time === 'string' ? item.time : '';
      const date = typeof item.date === 'string' ? item.date : undefined;
      const note = typeof item.note === 'string' ? item.note : undefined;
      if (time || note) {
        out.push({ time, ...(date ? { date } : {}), ...(note ? { note } : {}) });
      }
    }
  }
  return out.length ? out : undefined;
}

export function toReservationItem(row: EFReservationRow): ReservationItem {
  const alternatives = normalizeClientAlternatives(row.alternatives);
  const counterOffer =
    row.status === 'pending' && (alternatives?.length ?? 0) > 0;
  return {
    id: row.id,
    projectId: row.place?.id ?? '',
    placeName: row.place?.name ?? 'Reservation',
    placePhoto: row.place?.photos?.[0] ?? null,
    when: formatReservationWhen(row.reserved_at),
    reservedAt: row.reserved_at,
    partySize: row.party_size,
    status: toCardStatus(row.status),
    statusNote: noteFor(row, counterOffer),
    guestNotify: row.guest_notify === 'app' ? 'app' : 'call',
    guestConfirmedAt: row.guest_confirmed_at ?? null,
    alternatives,
    dbStatus: row.status,
    // linkedCoupon intentionally omitted: the list EF exposes the coupon by
    // id only, and cross-looking it up is out of scope for MESITA-715.
  };
}
