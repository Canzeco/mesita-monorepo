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
