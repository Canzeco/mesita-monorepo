"use server";

// Server actions for Verification Config. Thin wrappers over the admin-web-*
// Edge Functions via the Result-style efInvoke (never throws). Backed by the
// `verification` section of admin-web-get/update-config, on the app_config
// verification knobs. The update is a read-merge-write on the EF side, which
// is what lets this page save one switch at a time. No client ever touches
// the DB.

import { efInvoke } from "@/lib/supabase-ef";
import { normalizeVerificationConfig, type VerificationConfig } from "./defaults";

type ConfigPayload = {
  config: Partial<Record<keyof VerificationConfig, unknown>>;
  updatedAt: string | null;
};

type GetResult =
  | { ok: true; config: VerificationConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function getVerificationConfig(): Promise<GetResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-get-config", {
    section: "verification",
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalizeVerificationConfig(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}

type UpdateResult =
  | { ok: true; config: VerificationConfig; updatedAt: string | null }
  | { ok: false; error: string };

export async function updateVerificationConfig(
  patch: Partial<VerificationConfig>,
): Promise<UpdateResult> {
  const r = await efInvoke<ConfigPayload>("admin-web-update-config", {
    section: "verification",
    config: patch,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    config: normalizeVerificationConfig(r.data.config),
    updatedAt: r.data.updatedAt ?? null,
  };
}
