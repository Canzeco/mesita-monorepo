"use server";

import type { ActionResult } from "@/lib/action-result";
import { efInvoke } from "@/lib/supabase-ef";

// ─── Reset database ─────────────────────────────────────────────────────
// Moved here from Admins (2026-07-26): DB-wide operator actions live on
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
    /** Test-mode Stripe ids nothing in the DB points at any more. */
    stripe_left_behind?: {
      connected_accounts?: string[];
      customers?: string[];
    };
    reset_at?: string;
  };
};

// MESITA-3590: the SQL refuses (and changes nothing) while money is open or a
// Stripe row is live; the EF answers 409 with code "reset_refused" and this.
type RefusedResult = {
  refused?: string[];
  open_money?: { table: string; id: string; status: string }[];
  open_money_count?: number;
  livemode_rows?: { table: string; id: string }[];
};

/** The refusal as one sentence per reason, naming each blocking row. */
function refusalMessage(r: RefusedResult): string {
  const parts: string[] = [];
  const open = r.open_money ?? [];
  if (open.length > 0) {
    const total = r.open_money_count ?? open.length;
    const rows = open.map((o) => `${o.table} ${o.id} (${o.status})`).join(", ");
    const more = total > open.length ? `, and ${total - open.length} more` : "";
    parts.push(
      `Reset refused: ${total} payment(s) are still open — ${rows}${more}. ` +
        `Settle, cancel or let them expire first.`,
    );
  }
  const live = r.livemode_rows ?? [];
  if (live.length > 0) {
    parts.push(
      `Reset refused: live Stripe rows — ` +
        live.map((l) => `${l.table} ${l.id}`).join(", ") +
        `. A reset would strand live Stripe accounts or customers.`,
    );
  }
  return parts.join(" ") || "Reset refused.";
}

type ResetResult = ActionResult<{
  truncatedTables: number | null;
  deletedAuthUsers: number | null;
  purgedStorageObjects: number;
  remainingStorageObjects: number;
  storageDone: boolean;
  storagePurgeError: string | null;
  stripeAccountsLeft: string[];
  stripeCustomersLeft: string[];
}>;

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
  if (!r.ok) {
    if (r.code === "reset_refused") {
      const refused = (r.data as { result?: RefusedResult } | null)?.result;
      return { ok: false, error: refusalMessage(refused ?? {}) };
    }
    return { ok: false, error: r.error };
  }
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
    stripeAccountsLeft: result?.stripe_left_behind?.connected_accounts ?? [],
    stripeCustomersLeft: result?.stripe_left_behind?.customers ?? [],
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
