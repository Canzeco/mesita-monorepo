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

// ── Playground: intent targets, sandbox runs, sandbox tickets ────────────────
//
// The Playground emulates a fake-user reservation: a REAL place + a REAL
// consumer (both from the Mesita DB) + operator-authored intent. Runs create
// SANDBOX tickets in public.playground_reservations — never public.reservations
// — and place a REAL Reservationist call whose numbers (business + consumer
// side) each resolve to a test line or the actual DB phone, per run.

export type PlaceTarget = {
  id: string;
  name: string;
  address: string | null;
  photo: string | null;
  /** The line "actual number" mode would dial; null = place has no phone endpoint. */
  phone: string | null;
};

export type ConsumerTarget = {
  id: string;
  name: string;
  phone: string | null;
  avatar: string | null;
};

export type SearchTargetsResult<T> =
  | { ok: true; results: T[] }
  | { ok: false; error: string };

export async function searchPlaceTargets(
  query: string,
): Promise<SearchTargetsResult<PlaceTarget>> {
  const r = await efInvoke<{ results: PlaceTarget[] }>(
    "admin-web-search-reservation-targets",
    { kind: "place", query },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, results: r.data.results ?? [] };
}

export async function searchConsumerTargets(
  query: string,
): Promise<SearchTargetsResult<ConsumerTarget>> {
  const r = await efInvoke<{ results: ConsumerTarget[] }>(
    "admin-web-search-reservation-targets",
    { kind: "consumer", query },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, results: r.data.results ?? [] };
}

export type NumberMode = "test" | "actual";

/** A sandbox ticket — a playground_reservations row, verbatim from the EF. */
export type PlaygroundTicket = {
  id: string;
  created_at: string;
  project_id: string;
  place_name: string;
  consumer_id: string;
  consumer_name: string;
  reserved_at: string;
  party_size: number;
  notes: string | null;
  status: string;
  business_number_mode: NumberMode;
  business_number: string | null;
  consumer_number_mode: NumberMode;
  consumer_number: string | null;
  call_status: string | null;
  conversation_id: string | null;
  called_at: string | null;
};

export type CreatePlaygroundReservationInput = {
  project_id: string;
  consumer_id: string;
  /** Venue-local wall clock from datetime-local ("YYYY-MM-DDTHH:mm"). */
  reserved_at: string;
  party_size: number;
  notes: string;
  business_number_mode: NumberMode;
  consumer_number_mode: NumberMode;
};

export type CreatePlaygroundReservationResult =
  | {
      ok: true;
      ticket: PlaygroundTicket;
      call: { ok: true; conversation_id: string | null; dialed: string } | { ok: false; error: string };
    }
  | { ok: false; error: string };

/**
 * Run the intent: create the sandbox ticket, then place the REAL call. Spends
 * ElevenLabs/Twilio budget. A failed call still returns ok:true with the ticket
 * — the sandbox remembers every run; branch on `call.ok` for the outcome.
 */
export async function createPlaygroundReservation(
  input: CreatePlaygroundReservationInput,
): Promise<CreatePlaygroundReservationResult> {
  const r = await efInvoke<{
    ticket: PlaygroundTicket;
    call: { ok: true; conversation_id: string | null; dialed: string } | { ok: false; error: string };
  }>("admin-web-create-playground-reservation", input);
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, ticket: r.data.ticket, call: r.data.call };
}

export type ListPlaygroundReservationsResult =
  | { ok: true; tickets: PlaygroundTicket[] }
  | { ok: false; error: string };

export async function listPlaygroundReservations(): Promise<ListPlaygroundReservationsResult> {
  const r = await efInvoke<{ tickets: PlaygroundTicket[] }>(
    "admin-web-list-playground-reservations",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, tickets: r.data.tickets ?? [] };
}
