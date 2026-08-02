"use server";

// Server actions for Rewards Config. Thin wrappers over the admin-web-*
// Edge Functions via the Result-style efInvoke (never throws) — same contract as
// the Reservations / Sourcing / Memo config actions.
//
// Backed by admin-web-get-rewards-config / admin-web-update-rewards-config, which
// read and write the rewards_config jsonb on the public.app_settings singleton.
// No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { coerceConfig, type RewardsConfig } from "./catalog";

type GetRewardsConfigResult =
  | { ok: true; config: RewardsConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getRewardsConfig(): Promise<GetRewardsConfigResult> {
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-get-rewards-config",
    {},
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: coerceConfig(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}

type UpdateRewardsConfigResult =
  | { ok: true; config: RewardsConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateRewardsConfig(
  config: RewardsConfig,
): Promise<UpdateRewardsConfigResult> {
  const r = await efInvoke<{ config: unknown; updatedAt: string | null }>(
    "admin-web-update-rewards-config",
    { config },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: coerceConfig(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}

type GrantClassResult =
  | { ok: true; classKey: string; origin: string }
  | { ok: false; error: string };

// The Aura door (segments v6): grant writes aura/'invitation'; revoke
// recomputes the best remaining door server-side (subscription → premium,
// reach → influencer, else standard).
export async function grantAura(
  consumerId: string,
  grant: boolean,
): Promise<GrantClassResult> {
  const r = await efInvoke<{ classKey: string; origin: string }>(
    "admin-web-grant-class",
    { consumerId, classKey: grant ? "aura" : null },
  );
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, classKey: r.data.classKey, origin: r.data.origin };
}
