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

// ── Playground: intent targets + runs on the ONE reservations table ──────────
//
// The sandbox is retired (2026-07-27). A Playground run is a REAL row in
// public.reservations flagged is_test — same engine, same agent tool, same
// reference code as any guest booking; consumer/business surfaces filter
// is_test rows out. Numbers (business + consumer side) each resolve to a test
// line or the actual DB phone, per run.

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

export type ListTargetsResult<T> =
  | { ok: true; results: T[] }
  | { ok: false; error: string };

// No search — the EF returns a small random sample of real rows to pick from.
export async function listPlaceTargets(): Promise<ListTargetsResult<PlaceTarget>> {
  const r = await efInvoke<{ results: PlaceTarget[] }>(
    "admin-web-search-reservation-targets",
    { kind: "place" },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, results: r.data.results ?? [] };
}

export async function listConsumerTargets(): Promise<ListTargetsResult<ConsumerTarget>> {
  const r = await efInvoke<{ results: ConsumerTarget[] }>(
    "admin-web-search-reservation-targets",
    { kind: "consumer" },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, results: r.data.results ?? [] };
}

export type NumberMode = "test" | "actual";

/** One entry of a ticket's intent log. */
export type PlaygroundAttempt = {
  n: number;
  started_at: string;
  conversation_id: string | null;
  /**
   * dialing | ringing | answered | no_answer | unknown | confirmed | declined
   * | unresolved | placement failed: … — confirmed/declined/unresolved are the
   * venue's verdict on the answered intent.
   */
  result: string;
};

/** An admin-shaped reservations row (names joined server-side by the list EF). */
export type PlaygroundTicket = {
  id: string;
  created_at: string;
  /** The ticket's 8-digit reference code (null only on pre-code rows). */
  reference_code: string | null;
  project_id: string;
  place_name: string;
  consumer_name: string;
  /** Playground-created row — hidden from every consumer/business surface. */
  is_test: boolean;
  reserved_at: string;
  party_size: number;
  notes: string | null;
  /** Verdict: pending | confirmed | declined | unresolved | unreachable. */
  status: string;
  business_number: string | null;
  consumer_number: string | null;
  call_status: string | null;
  conversation_id: string | null;
  called_at: string | null;
  attempts: PlaygroundAttempt[];
  attempts_planned: number;
  /** running | answered | exhausted | error — the UI polls while running. */
  attempts_state: string;
  /**
   * The business→consumer confirmation call (fires only after the venue
   * confirms): none | skipped | calling | ringing | answered | no_answer |
   * unknown | failed.
   */
  callback_state: string;
  callback_conversation_id: string | null;
  callback_at: string | null;
  confirmed_at: string | null;
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
  | { ok: true; ticket: PlaygroundTicket }
  | { ok: false; error: string };

/**
 * Run the intent, ticket-first: the EF inserts a REAL reservations row flagged
 * is_test and hands off to the production call engine, which acks immediately;
 * the intents run server-side, updating the row as they go — poll the list to
 * watch. Spends ElevenLabs/Twilio budget.
 */
export async function createPlaygroundReservation(
  input: CreatePlaygroundReservationInput,
): Promise<CreatePlaygroundReservationResult> {
  const r = await efInvoke<{ ticket: PlaygroundTicket }>(
    "admin-web-create-test-reservation",
    input,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, ticket: r.data.ticket };
}

export type ListPlaygroundReservationsResult =
  | { ok: true; tickets: PlaygroundTicket[] }
  | { ok: false; error: string };

/** Newest reservations — real and test alike, admin-shaped. */
export async function listPlaygroundReservations(): Promise<ListPlaygroundReservationsResult> {
  const r = await efInvoke<{ tickets: PlaygroundTicket[] }>(
    "admin-web-list-reservations",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, tickets: r.data.tickets ?? [] };
}

export type DeletePlaygroundReservationsResult =
  | { ok: true; deleted: number }
  | { ok: false; error: string };

/** Delete one reservation by id, or every is_test row with { all_test: true }. */
export async function deletePlaygroundReservations(
  input: { id: string } | { all_test: true },
): Promise<DeletePlaygroundReservationsResult> {
  const r = await efInvoke<{ deleted: number }>(
    "admin-web-delete-reservation",
    input,
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, deleted: r.data.deleted ?? 0 };
}
