import { invokeEF } from '@/lib/ef';
import { supabase } from '@/lib/supabase';

// Booking through the Reservationist. The EF writes a pending reservation row
// and (server-side) fires the outbound call to the place — the client just
// collects the params and shows the pending state. Web parity:
// apps/web-consumer/src/lib/api/reservations.ts.

type CreatedReservation = {
  reservation: {
    id: string;
    reserved_at: string;
    party_size: number;
    status: string;
    notes: string | null;
  };
  linked_coupon_id: string | null;
  /** Whether the outbound-call trigger was accepted (best-effort). */
  call_triggered?: boolean;
};

type GuestNotify = 'call' | 'app';

type PlaceAlternative = {
  time: string;
  date?: string;
  note?: string;
};

export function apiCreateReservation(args: {
  /** places.id == projects.id — the place being booked. */
  projectId: string;
  /** ISO 8601 instant (built with an explicit MX offset by the caller). */
  reservedAt: string;
  partySize: number;
  notes?: string;
  /** MESITA-787 — default "call". */
  guestNotify?: GuestNotify;
}): Promise<CreatedReservation> {
  const notes = args.notes?.trim();
  return invokeEF<CreatedReservation>(
    supabase,
    'consumer-web-create-reservation',
    {
      project_id: args.projectId,
      reserved_at: args.reservedAt,
      party_size: args.partySize,
      ...(notes ? { notes } : {}),
      guest_notify: args.guestNotify === 'app' ? 'app' : 'call',
    },
    "Couldn't create the reservation",
  );
}

/** Accept confirmation or a place alternative without an a2 call (MESITA-787). */
export function apiConfirmReservation(args: {
  reservationId: string;
  newDate?: string;
  newTime?: string;
}): Promise<{ guest_confirmed: boolean; confirmed_on_the_spot?: boolean }> {
  return invokeEF<{ guest_confirmed: boolean; confirmed_on_the_spot?: boolean }>(
    supabase,
    'consumer-web-confirm-reservation',
    {
      reservation_id: args.reservationId,
      ...(args.newDate ? { new_date: args.newDate } : {}),
      ...(args.newTime ? { new_time: args.newTime } : {}),
    },
    "Couldn't confirm the reservation",
  );
}

// Which slice of the caller's bookings to list. "upcoming" = pending |
// confirmed; "past" = the terminal states; "all" leaves it unfiltered.
export type ReservationScope = 'upcoming' | 'past' | 'all';

// One row from consumer-web-list-reservations: booking metadata joined with
// the place summary. No money fields (entity split); coupon by id only.
export type EFReservationRow = {
  id: string;
  reserved_at: string;
  party_size: number;
  status:
    | 'pending'
    | 'confirmed'
    | 'declined'
    | 'no_show'
    | 'cancelled'
    // Engine outcomes: the place never answered / the call ended unclear.
    | 'unreachable'
    | 'unresolved';
  notes: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  coupon_id: string | null;
  created_at: string;
  /** Run state — parked vs mid-call (MESITA-954). */
  attempts_state?: string | null;
  next_attempt_at?: string | null;
  call_attempts?: number | null;
  /** MESITA-787 — whether a2 may ring the guest. */
  guest_notify?: GuestNotify | null;
  guest_confirmed_at?: string | null;
  alternatives?: PlaceAlternative[] | string[] | null;
  place: {
    id: string;
    slug: string | null;
    name: string | null;
    category: string | null;
    photos: string[] | null;
    address: string | null;
  } | null;
};

/**
 * Reschedule (or resize) the caller's own reservation. New terms send the
 * ticket back to `booking` and Mesita calls the place again. Web parity:
 * apps/web-consumer/src/lib/api/reservations.ts.
 */
export function apiUpdateReservation(args: {
  reservationId: string;
  /** ISO 8601 instant with an explicit MX offset. */
  reservedAt?: string;
  partySize?: number;
  notes?: string;
}): Promise<{ updated: boolean; call_started?: boolean }> {
  return invokeEF<{ updated: boolean; call_started?: boolean }>(
    supabase,
    'consumer-web-update-reservation',
    {
      reservation_id: args.reservationId,
      ...(args.reservedAt ? { reserved_at: args.reservedAt } : {}),
      ...(typeof args.partySize === 'number'
        ? { party_size: args.partySize }
        : {}),
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
    },
    "Couldn't update the reservation",
  );
}

export function apiListReservations(
  args: { scope?: ReservationScope; limit?: number } = {},
): Promise<{ reservations: EFReservationRow[] }> {
  return invokeEF<{ reservations: EFReservationRow[] }>(
    supabase,
    'consumer-web-list-reservations',
    {
      ...(args.scope ? { scope: args.scope } : {}),
      ...(typeof args.limit === 'number' ? { limit: args.limit } : {}),
    },
    "Couldn't load your reservations",
  );
}
