"use server";

// Server actions for Rewards Config. Thin wrappers over the admin-web-*
// Edge Functions via the Result-style efInvoke (never throws) — same contract as
// the Reservations / Sourcing / Memo config actions.
//
// Backed by admin-web-get-rewards-config / admin-web-update-rewards-config,
// which read and write the NORMALIZED public.reward_rules table (v8,
// MESITA-873) plus the universal cap scalar on app_settings. No client ever
// touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { coerceRules, type RewardsConfig } from "./catalog";

type GetRewardsConfigResult =
  | { ok: true; config: RewardsConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getRewardsConfig(): Promise<GetRewardsConfigResult> {
  const r = await efInvoke<{
    rules: unknown;
    cap: unknown;
    updatedAt: string | null;
  }>("admin-web-get-rewards-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: coerceRules(r.data.rules, r.data.cap),
    updatedAt: r.data.updatedAt ?? null,
  };
}

type UpdateRewardsConfigResult =
  | { ok: true; config: RewardsConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateRewardsConfig(
  config: RewardsConfig,
): Promise<UpdateRewardsConfigResult> {
  // A WHOLE-TABLE write: the payout table is one coherent thing, so every
  // rule ships on every save and the EF upserts all 60 in one call.
  const r = await efInvoke<{
    rules: unknown;
    cap: unknown;
    updatedAt: string | null;
  }>("admin-web-update-rewards-config", {
    rules: config.rules,
    cap: config.cap,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: coerceRules(r.data.rules, r.data.cap),
    updatedAt: r.data.updatedAt ?? null,
  };
}
