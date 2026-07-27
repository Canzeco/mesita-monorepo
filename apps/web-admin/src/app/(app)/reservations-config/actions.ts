"use server";

// Server actions for Reservations Config. Thin wrappers over the admin-web-*
// Edge Functions via the Result-style efInvoke (never throws) — same contract as
// the Sourcing / Memo / Atlas config actions.
//
// Backed by admin-web-get-reservations-config / admin-web-update-reservations-config,
// which read and write the reservations_config jsonb on the public.app_settings
// singleton. No client ever touches the DB.
//
// The Playground actions that used to live here are gone with the Playground
// itself (2026-07-27) — testing happens from the consumer app with test mode ON.

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
