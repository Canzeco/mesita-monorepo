"use server";

import { efInvoke } from "@/lib/supabase-ef";

type ResetResponse = {
  result?: {
    deleted_auth_users?: number;
    reset_at?: string;
  };
};

type ResetResult =
  | { ok: true; deletedAuthUsers: number | null }
  | { ok: false; error: string };

// Calls the admin-reset-database EF. The EF re-checks super_admins and
// requires confirm === "RESET", so this action is only a thin pass-through.
export async function resetDatabase(confirm: string): Promise<ResetResult> {
  const r = await efInvoke<ResetResponse>("admin-reset-database", { confirm });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    deletedAuthUsers: r.data.result?.deleted_auth_users ?? null,
  };
}
