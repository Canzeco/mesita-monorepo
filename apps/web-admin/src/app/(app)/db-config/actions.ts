"use server";

import { efInvoke } from "@/lib/supabase-ef";

// ─── Reset database ─────────────────────────────────────────────────────
// Moved here from Admin Config (2026-07-26): DB-wide operator actions live on
// the DB Config page now.

type ResetResponse = {
  result?: {
    truncated_tables?: number;
    deleted_auth_users?: number;
    purged_storage_objects?: number;
    // Set when the DB wipe committed but the storage purge stopped early —
    // the reset DID happen, some files are still there. Re-running clears them.
    storage_purge_error?: string | null;
    reset_at?: string;
  };
};

type ResetResult =
  | {
    ok: true;
    truncatedTables: number | null;
    deletedAuthUsers: number | null;
    purgedStorageObjects: number | null;
    storagePurgeError: string | null;
  }
  | { ok: false; error: string };

// Calls the admin-reset-database EF. The EF re-checks super_admins and
// requires confirm === "RESET", so this action is only a thin pass-through.
export async function resetDatabase(confirm: string): Promise<ResetResult> {
  const r = await efInvoke<ResetResponse>("admin-web-reset-database", {
    confirm,
  });
  if (!r.ok) return { ok: false, error: r.error };
  return {
    ok: true,
    truncatedTables: r.data.result?.truncated_tables ?? null,
    deletedAuthUsers: r.data.result?.deleted_auth_users ?? null,
    purgedStorageObjects: r.data.result?.purged_storage_objects ?? null,
    storagePurgeError: r.data.result?.storage_purge_error ?? null,
  };
}
