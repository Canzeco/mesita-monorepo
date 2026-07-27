"use server";

// Server actions for Reservations Config. Thin wrappers over the admin-web-*
// Edge Functions via the Result-style efInvoke (never throws) — same contract as
// the Sourcing / Memo / Atlas config actions.
//
// Backed by admin-web-get-reservations-config / admin-web-update-reservations-config,
// which read and write the reservations_config jsonb on the public.app_settings
// singleton. No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { coerceConfig, type ReservationsConfig } from "./catalog";

export type GetReservationsConfigResult =
  | { ok: true; config: ReservationsConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getReservationsConfig(): Promise<GetReservationsConfigResult> {
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-get-reservations-config",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}

export type UpdateReservationsConfigResult =
  | { ok: true; config: ReservationsConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateReservationsConfig(
  config: ReservationsConfig,
): Promise<UpdateReservationsConfigResult> {
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-reservations-config",
    { config },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}

// The booking variables the Reservationist reads back on a test call. date/time
// arrive already es-MX formatted (the Playground echoes the operator's wall-clock)
// so the spoken brief matches the preview exactly.
export type TestCallBooking = {
  guest_name: string;
  party_size: number;
  venue_name: string;
  notes: string;
  reservation_date: string;
  reservation_time: string;
};

export type PlaceReservationTestCallResult =
  | { ok: true; conversationId: string | null; dialed: string }
  | { ok: false; error: string };

/**
 * Fake-user mode: place a REAL Reservationist call to the configured test number.
 * The EF resolves the number from config (never a venue) and returns the live
 * conversation_id. This spends ElevenLabs/Twilio budget — it is not a dry run.
 */
export async function placeReservationTestCall(
  booking: TestCallBooking,
): Promise<PlaceReservationTestCallResult> {
  const r = await efInvoke<{ conversation_id: string | null; dialed: string }>(
    "admin-web-place-reservation-test-call",
    booking,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, conversationId: r.data.conversation_id ?? null, dialed: r.data.dialed };
}
