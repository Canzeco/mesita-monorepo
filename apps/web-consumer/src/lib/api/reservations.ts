import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

// Booking through the Reservationist. The EF writes a pending reservation row
// and (server-side) fires the outbound call to the place — the client just
// collects the params and shows the pending state.

type CreatedReservation = {
  reservation: {
    id: string;
    reserved_at: string;
    party_size: number;
    status: string;
    notes: string | null;
  };
  linked_coupon_id: string | null;
  /** Whether the outbound-call trigger was accepted (best-effort; not required). */
  call_triggered?: boolean;
};

export function apiCreateReservation(
  client: SupabaseClient,
  args: {
    /** places.id == projects.id — the place being booked. */
    projectId: string;
    /** ISO 8601 instant (built with an explicit MX offset by the caller). */
    reservedAt: string;
    partySize: number;
    notes?: string;
  },
): Promise<CreatedReservation> {
  const notes = args.notes?.trim();
  return invokeEF<CreatedReservation>(
    client,
    "consumer-web-create-reservation",
    {
      project_id: args.projectId,
      reserved_at: args.reservedAt,
      party_size: args.partySize,
      ...(notes ? { notes } : {}),
    },
    "Couldn't create the reservation",
  );
}

// Which slice of the caller's bookings to list. "upcoming" = pending |
// confirmed; "past" = the terminal states; "all" leaves it unfiltered.
export type ReservationScope = "upcoming" | "past" | "all";

// One row from consumer-web-list-reservations: booking metadata joined with
// the place summary. No money fields (the entity split keeps discounts on the
// coupon row); the linked coupon is exposed by id only.
export type EFReservationRow = {
  id: string;
  reserved_at: string;
  party_size: number;
  status:
    | "pending"
    | "confirmed"
    | "declined"
    | "no_show"
    | "cancelled"
    // Engine outcomes: the venue never answered / the call ended unclear.
    | "unreachable"
    | "unresolved";
  /** The ticket's 8-digit reference code (null only on pre-code rows). */
  reference_code: string | null;
  /** Run state — the app reads these to tell `created` from `booking`. */
  attempts_state: string | null;
  call_attempts: number | null;
  notes: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  coupon_id: string | null;
  created_at: string;
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
 * Cancel the caller's own reservation. Idempotent server-side; a slot that
 * already passed is refused (there's nothing left to call off).
 */
export function apiCancelReservation(
  client: SupabaseClient,
  args: { reservationId: string; reason?: string },
): Promise<{ cancelled?: boolean; already?: boolean }> {
  const reason = args.reason?.trim();
  return invokeEF<{ cancelled?: boolean; already?: boolean }>(
    client,
    "consumer-web-cancel-reservation",
    { reservation_id: args.reservationId, ...(reason ? { reason } : {}) },
    "Couldn't cancel the reservation",
  );
}

/**
 * Reschedule (or resize) the caller's own reservation. New terms send the
 * ticket back to `booking` and Mesita calls the venue again.
 */
export function apiUpdateReservation(
  client: SupabaseClient,
  args: {
    reservationId: string;
    /** ISO 8601 instant with an explicit MX offset. */
    reservedAt?: string;
    partySize?: number;
    notes?: string;
  },
): Promise<{ updated: boolean; call_started?: boolean }> {
  return invokeEF<{ updated: boolean; call_started?: boolean }>(
    client,
    "consumer-web-update-reservation",
    {
      reservation_id: args.reservationId,
      ...(args.reservedAt ? { reserved_at: args.reservedAt } : {}),
      ...(typeof args.partySize === "number"
        ? { party_size: args.partySize }
        : {}),
      ...(args.notes !== undefined ? { notes: args.notes } : {}),
    },
    "Couldn't update the reservation",
  );
}

export function apiListReservations(
  client: SupabaseClient,
  args: { scope?: ReservationScope; limit?: number } = {},
): Promise<{ reservations: EFReservationRow[] }> {
  return invokeEF<{ reservations: EFReservationRow[] }>(
    client,
    "consumer-web-list-reservations",
    {
      ...(args.scope ? { scope: args.scope } : {}),
      ...(typeof args.limit === "number" ? { limit: args.limit } : {}),
    },
    "Couldn't load your reservations",
  );
}
