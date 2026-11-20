"use server";

// Server actions for Reservations Config. Thin wrappers over the admin-web-*
// Edge Functions via the Result-style efInvoke (never throws) — same contract as
// the Sourcing / Memo / Atlas config actions.
//
// Backed by the `reservations` section of admin-web-get-config /
// admin-web-update-config, which read and write the reservations_config jsonb
// on the public.app_config singleton. The read also carries the
// needs-attention feed, which Logs renders (MESITA-4293). No client ever
// touches the DB.
//
// The Playground actions that used to live here are gone with the Playground
// itself (2026-07-27) — testing happens from the consumer app with test mode ON.

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";
import { coerceConfig, type NeedsAttentionRow, type ReservationsConfig } from "./catalog";

type GetReservationsConfigResult = ActionResult<{
  config: ReservationsConfig;
  updatedAt: string | null;
  needsAttention: NeedsAttentionRow[];
  needsAttentionError: string | null;
  needsAttentionMore: boolean;
}>;

export async function getReservationsConfig(): Promise<GetReservationsConfigResult> {
  const r = await efInvoke<{
    config: unknown;
    updatedAt: string | null;
    needs_attention?: NeedsAttentionRow[];
    needs_attention_error?: string | null;
    needs_attention_more?: boolean;
  }>(
    "admin-web-get-config",
    { section: "reservations" },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: coerceConfig(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
    needsAttention: Array.isArray(r.data.needs_attention) ? r.data.needs_attention : [],
    needsAttentionError: typeof r.data.needs_attention_error === "string" ? r.data.needs_attention_error : null,
    needsAttentionMore: r.data.needs_attention_more === true,
  };
}

type UpdateReservationsConfigResult = ActionResult<{
  config: ReservationsConfig;
  updatedAt: string | null;
}>;

export async function updateReservationsConfig(
  config: ReservationsConfig,
): Promise<UpdateReservationsConfigResult> {
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-config",
    { section: "reservations", config },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, config: coerceConfig(r.data.config), updatedAt: r.data.updatedAt ?? null };
}

// ─── Call cost (MESITA-4043) ───────────────────────────────────────────────

export type CallCost = {
  days: number;
  plan: string | null;
  /** USD → MXN (Frankfurter, ECB); null when the rate could not be read. */
  mxnPerUsd: number | null;
  truncated: boolean;
  calls: number;
  minutes: number;
  credits: number;
  creditsPerMinute: number | null;
  avgCallSeconds: number | null;
  usdPerCredit: number | null;
  usdPerMinute: number | null;
  priceSource: "invoice" | "list" | null;
};

/** What a minute of a reservation call costs on ElevenLabs, from the
 *  agents' real calls of the last `days` (admin-web-get-call-cost). */
export async function getCallCost(days = 30): Promise<ActionResult<{ cost: CallCost }>> {
  const r = await efInvoke<CallCost>("admin-web-get-call-cost", { days });
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, cost: r.data };
}
