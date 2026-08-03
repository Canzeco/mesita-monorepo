// Storage purge for admin-web-reset-database.
//
// A reset truncates place_media_assets, so every object those rows pointed at
// becomes an orphan the moment the wipe lands. Nothing ever collected them:
// the live singleton held 3,250 files in `place-images` against 22 surviving
// rows when this module was written.
//
// Deleting `storage.objects` rows in SQL would make that WORSE — the row goes,
// the S3 object stays, and now nothing even knows it exists. Only the Storage
// API removes both, and that is an HTTP call, so the purge lives here rather
// than inside public.admin_reset_database().
//
// The loop drains rather than paginates: public.admin_reset_storage_paths()
// hands back the first N live paths, we delete them, and the next call sees
// what's left. No cursor to skip past a failed delete — which is exactly why
// a batch that removes nothing is treated as a stall and stops the loop
// instead of spinning.
//
// BUDGETED, RESUMABLE. Draining thousands of files takes longer than the
// caller's request budget (a Vercel server action, then the EF's own wall
// clock) is willing to wait, and an operator whose button times out on the
// slow half of the job has no way to tell a stalled reset from a working one.
// So a pass stops at `budgetMs` and reports `done: false` + what's left; the
// caller keeps calling until `done`. Every pass is independent — the lister
// always returns live objects — so resuming is just calling again.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type StoragePathRow = { bucket_id: string; name: string };

export type PurgeResult = {
  /** Objects actually removed by THIS pass (both file and metadata row). */
  purged: number;
  /** Objects still in the buckets when this pass returned. */
  remaining: number;
  /** false → the budget ran out mid-drain; call again to continue. */
  done: boolean;
  /** Non-null when the purge stopped on an error, never on the budget. */
  error: string | null;
};

export type PurgeOptions = {
  keepBuckets?: string[];
  /** Wall-clock budget for one pass. */
  budgetMs?: number;
  /** Injectable clock — tests drive the budget without sleeping. */
  now?: () => number;
};

// Buckets a reset keeps. Empty on purpose: every bucket today (place-images,
// menu-images, menu-pdfs) holds place-owned media whose owning rows are wiped,
// so keeping any of it would just re-create the orphan problem. Add a bucket
// here only if its contents outlive the places that produced them.
export const PRESERVED_BUCKETS: string[] = [];

// 200 paths per Storage remove() call — well under the API's limit, small
// enough that one failing object doesn't sink a large batch.
const BATCH = 200;
// One pass never runs longer than this. Sized to fit inside the shortest hop
// in the chain (the admin app's server action), not the EF's own wall clock —
// the caller resumes, so a small budget costs a round trip, never progress.
export const DEFAULT_BUDGET_MS = 20_000;
// A wall, not a budget: hitting it means something is re-creating objects
// mid-purge. Bounds a single pass even if the clock misbehaves.
const MAX_BATCHES = 200;

/** Group a page of paths by bucket so each bucket gets one remove() call. */
export function groupByBucket(rows: StoragePathRow[]): Map<string, string[]> {
  const byBucket = new Map<string, string[]>();
  for (const row of rows) {
    if (!row?.bucket_id || !row?.name) continue;
    const paths = byBucket.get(row.bucket_id);
    if (paths) paths.push(row.name);
    else byBucket.set(row.bucket_id, [row.name]);
  }
  return byBucket;
}

/** Live object count, so the caller can show real progress and stop at 0. */
async function countRemaining(
  admin: SupabaseClient,
  keepBuckets: string[],
): Promise<number> {
  const { data, error } = await admin.rpc("admin_reset_storage_count", {
    p_keep_buckets: keepBuckets,
  });
  if (error) return 0;
  return Number(data ?? 0);
}

/**
 * Empty every non-preserved bucket, up to `budgetMs` of work. Never throws:
 * the caller runs this AFTER the DB wipe has already committed, so a storage
 * failure is reported, not raised — the reset really did happen.
 *
 * Returns `done: false` when the budget ran out with objects left. That is a
 * normal outcome, not an error: call again to pick up where it stopped.
 */
export async function purgeStorageObjects(
  admin: SupabaseClient,
  options: PurgeOptions = {},
): Promise<PurgeResult> {
  const keepBuckets = options.keepBuckets ?? PRESERVED_BUCKETS;
  const budgetMs = options.budgetMs ?? DEFAULT_BUDGET_MS;
  const now = options.now ?? (() => Date.now());
  const deadline = now() + budgetMs;

  let purged = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    // Checked BEFORE the work, so a pass never overshoots by a whole batch.
    if (batch > 0 && now() >= deadline) {
      return {
        purged,
        remaining: await countRemaining(admin, keepBuckets),
        done: false,
        error: null,
      };
    }

    const { data, error } = await admin.rpc("admin_reset_storage_paths", {
      p_limit: BATCH,
      p_keep_buckets: keepBuckets,
    });
    if (error) {
      return {
        purged,
        remaining: await countRemaining(admin, keepBuckets),
        done: false,
        error: `list_objects: ${error.message}`,
      };
    }

    const rows = (data ?? []) as StoragePathRow[];
    if (rows.length === 0) {
      return { purged, remaining: 0, done: true, error: null };
    }

    let removedThisBatch = 0;
    let lastError: string | null = null;
    for (const [bucket, paths] of groupByBucket(rows)) {
      const { data: removed, error: rmErr } = await admin.storage
        .from(bucket)
        .remove(paths);
      if (rmErr) {
        lastError = `remove(${bucket}): ${rmErr.message}`;
        continue;
      }
      removedThisBatch += removed?.length ?? 0;
    }
    purged += removedThisBatch;

    // Nothing shifted, so the next identical page would loop forever.
    if (removedThisBatch === 0) {
      return {
        purged,
        remaining: await countRemaining(admin, keepBuckets),
        done: false,
        error: lastError ??
          `stalled: ${rows.length} object(s) could not be removed`,
      };
    }
  }

  return {
    purged,
    remaining: await countRemaining(admin, keepBuckets),
    done: false,
    error: null,
  };
}
