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

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

export type StoragePathRow = { bucket_id: string; name: string };

export type PurgeResult = {
  /** Objects actually removed (both the file and its metadata row). */
  purged: number;
  /** Non-null when the purge stopped early — the DB wipe already succeeded. */
  error: string | null;
};

// Buckets a reset keeps. Empty on purpose: every bucket today (place-images,
// menu-images, menu-pdfs) holds place-owned media whose owning rows are wiped,
// so keeping any of it would just re-create the orphan problem. Add a bucket
// here only if its contents outlive the places that produced them.
export const PRESERVED_BUCKETS: string[] = [];

// 200 paths per Storage remove() call — well under the API's limit, small
// enough that one failing object doesn't sink a large batch.
const BATCH = 200;
// 40k objects (BATCH × this). A wall, not a budget: hitting it means something
// is re-creating objects mid-purge, and the operator should re-run.
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

/**
 * Empty every non-preserved bucket. Never throws: the caller runs this AFTER
 * the DB wipe has already committed, so a storage failure is reported, not
 * raised — the reset really did happen.
 */
export async function purgeStorageObjects(
  admin: SupabaseClient,
  keepBuckets: string[] = PRESERVED_BUCKETS,
): Promise<PurgeResult> {
  let purged = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const { data, error } = await admin.rpc("admin_reset_storage_paths", {
      p_limit: BATCH,
      p_keep_buckets: keepBuckets,
    });
    if (error) return { purged, error: `list_objects: ${error.message}` };

    const rows = (data ?? []) as StoragePathRow[];
    if (rows.length === 0) return { purged, error: null };

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
        error: lastError ??
          `stalled: ${rows.length} object(s) could not be removed`,
      };
    }
  }

  return {
    purged,
    error:
      `incomplete: stopped after ${MAX_BATCHES} batches — re-run the reset`,
  };
}
