"use server";

import { efInvoke } from "@/lib/supabase-ef";

// ─── Reset database ─────────────────────────────────────────────────────
// Moved here from Admin Config (2026-07-26): DB-wide operator actions live on
// the DB Config page now.
//
// A reset is TWO jobs behind one button: a single fast DB wipe, then a purge
// of every stored file — thousands of HTTP deletes that outlast any single
// request. So the EF does one time-budgeted slice per call and says whether
// it finished; the page keeps calling `continueStoragePurge` until it has.
// One press, however many round trips it takes.

type ResetResponse = {
  result?: {
    truncated_tables?: number;
    deleted_auth_users?: number;
    purged_storage_objects?: number;
    remaining_storage_objects?: number;
    /** false → the budget ran out with files left; call again. */
    storage_done?: boolean;
    // Set when the DB wipe committed but the storage purge stopped on an
    // error — the reset DID happen, some files are still there.
    storage_purge_error?: string | null;
    reset_at?: string;
  };
};

export type ResetResult =
  | {
    ok: true;
    truncatedTables: number | null;
    deletedAuthUsers: number | null;
    purgedStorageObjects: number;
    remainingStorageObjects: number;
    storageDone: boolean;
    storagePurgeError: string | null;
  }
  | { ok: false; error: string };

// The EF re-checks super_admins and requires confirm === "RESET", so these
// actions are only thin pass-throughs.
async function invokeReset(
  confirm: string,
  storageOnly: boolean,
): Promise<ResetResult> {
  const r = await efInvoke<ResetResponse>("admin-web-reset-database", {
    confirm,
    ...(storageOnly ? { storageOnly: true } : {}),
  });
  if (!r.ok) return { ok: false, error: r.error };
  const result = r.data.result;
  return {
    ok: true,
    truncatedTables: result?.truncated_tables ?? null,
    deletedAuthUsers: result?.deleted_auth_users ?? null,
    purgedStorageObjects: result?.purged_storage_objects ?? 0,
    remainingStorageObjects: result?.remaining_storage_objects ?? 0,
    // Absent on an EF old enough not to send it — treat as finished rather
    // than looping forever against a deployment that can't answer.
    storageDone: result?.storage_done ?? true,
    storagePurgeError: result?.storage_purge_error ?? null,
  };
}

/** First call: wipe the database, then purge one budget's worth of files. */
export async function resetDatabase(confirm: string): Promise<ResetResult> {
  return await invokeReset(confirm, false);
}

/** Continuation: purge the next slice. Never touches the database. */
export async function continueStoragePurge(
  confirm: string,
): Promise<ResetResult> {
  return await invokeReset(confirm, true);
}
