import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF, withPlaceId } from "./_invoke";

// Mesita Reservationist bookings for Performance (MESITA-900).
// Never class-shaped — EF strips class_key / class_origin.

type BusinessReservation = {
  id: string;
  reservedAt: string | null;
  partySize: number | null;
  status: string | null;
  isTest: boolean;
  guest: string;
};

export type PlaceReservations = {
  reservations: BusinessReservation[];
  reservationTotal: number;
  lines: { guest: string; place: string };
};

export async function listPlaceReservations(
  supabase: SupabaseClient,
  projectId: string,
  opts?: { limit?: number; scope?: "upcoming" | "past" | "all" },
): Promise<PlaceReservations> {
  return invokeEF<PlaceReservations>(
    supabase,
    "business-web-list-reservations",
    withPlaceId({
      projectId,
      limit: opts?.limit ?? 50,
      scope: opts?.scope ?? "all",
    }),
  );
}
