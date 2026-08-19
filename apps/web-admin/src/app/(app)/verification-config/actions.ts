"use server";

// Server actions for Verification Config. Thin wrappers over the admin-web-*
// Edge Functions via the Result-style efInvoke (never throws). Backed by
// admin-web-get/update-verification-config on app_config verification knobs.
// No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";

export type VerificationConfig = {
  createPlacesAsVerified: boolean;
  autoVerifyAiCall: boolean;
  autoVerifyAiEmail: boolean;
  autoVerifyVideo: boolean;
};

type ConfigPayload = {
  config: Partial<Record<keyof VerificationConfig, unknown>>;
  updatedAt: string | null;
};

function normalizeConfig(
  raw: Partial<Record<keyof VerificationConfig, unknown>> | undefined,
): VerificationConfig {
  return {
    createPlacesAsVerified: raw?.createPlacesAsVerified === true,
    autoVerifyAiCall: raw?.autoVerifyAiCall !== false,
    autoVerifyAiEmail: raw?.autoVerifyAiEmail !== false,
    autoVerifyVideo: raw?.autoVerifyVideo === true,
  };
}

type GetResult =
  | { ok: true; config: VerificationConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getVerificationConfig(): Promise<GetResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-get-verification-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalizeConfig(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}

type UpdateResult =
  | { ok: true; config: VerificationConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateVerificationConfig(
  patch: Partial<VerificationConfig>,
): Promise<UpdateResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-update-verification-config", {
    config: patch,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalizeConfig(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}
