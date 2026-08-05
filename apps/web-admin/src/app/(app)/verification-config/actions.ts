"use server";

// Server actions for Verification Config. Thin wrappers over the admin-web-*
// Edge Functions via the Result-style efInvoke (never throws). Backed by
// admin-web-get/update-verification-config on app_settings.create_places_as_verified.
// No client ever touches the DB.

import { efInvoke } from "@/lib/supabase-ef";

export type VerificationConfig = {
  createPlacesAsVerified: boolean;
};

type GetResult =
  | { ok: true; config: VerificationConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getVerificationConfig(): Promise<GetResult> {
  const r = await efInvoke<{
    config: { createPlacesAsVerified?: unknown };
    updatedAt: string | null;
  }>("admin-web-get-verification-config", {});
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: {
      createPlacesAsVerified: r.data.config?.createPlacesAsVerified === true,
    },
    updatedAt: r.data.updatedAt ?? null,
  };
}

type UpdateResult =
  | { ok: true; config: VerificationConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateVerificationConfig(
  config: VerificationConfig,
): Promise<UpdateResult> {
  const r = await efInvoke<{
    config: { createPlacesAsVerified?: unknown };
    updatedAt: string | null;
  }>("admin-web-update-verification-config", { config });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: {
      createPlacesAsVerified: r.data.config?.createPlacesAsVerified === true,
    },
    updatedAt: r.data.updatedAt ?? null,
  };
}
