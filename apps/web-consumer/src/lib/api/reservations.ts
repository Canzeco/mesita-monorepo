import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";

// Booking through the Reservationist. The EF writes a pending reservation row
// and (server-side) fires the outbound call to the place — the client just
// collects the params and shows the pending state.

export type CreatedReservation = {
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
