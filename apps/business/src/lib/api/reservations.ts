import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF } from "./_invoke";
import type { Database } from "@/lib/supabase/database.types";

export type ReservationStatus =
  Database["public"]["Enums"]["reservation_status"];
export type ReservationScope = "upcoming" | "past" | "all";

type ReservationConsumer = {
  id: string;
  code: string | null;
  full_name: string | null;
  tier_key: string | null;
  tier_origin: string | null;
};

type RawReservation = {
  id: string;
  reserved_at: string;
  party_size: number;
  status: ReservationStatus;
  notes: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  consumer: ReservationConsumer | ReservationConsumer[] | null;
};

export type BusinessReservation = Omit<RawReservation, "consumer"> & {
  consumer: ReservationConsumer | null;
};

// PostgREST returns embedded relations as an array; the booking has exactly
// one consumer, so collapse it to a single object (mirrors api/tickets.ts).
function normalizeReservation(row: RawReservation): BusinessReservation {
  const consumer = Array.isArray(row.consumer)
    ? (row.consumer[0] ?? null)
    : row.consumer;
  return { ...row, consumer };
}

export async function apiListReservations(
  client: SupabaseClient,
  input: { venueId: string; scope?: ReservationScope; limit?: number },
): Promise<BusinessReservation[]> {
  const { reservations } = await invokeEF<{ reservations: RawReservation[] }>(
    client,
    "business-list-reservations",
    input,
    "Couldn't load reservations.",
  );
  return (reservations ?? []).map(normalizeReservation);
}

export async function apiDecideReservation(
  client: SupabaseClient,
  input: {
    venueId: string;
    reservationId: string;
    decision: "confirm" | "decline";
  },
): Promise<{ reservation: BusinessReservation }> {
  const { reservation } = await invokeEF<{ reservation: RawReservation }>(
    client,
    "business-confirm-reservation",
    input,
    "Couldn't update the reservation.",
  );
  return { reservation: normalizeReservation(reservation) };
}
