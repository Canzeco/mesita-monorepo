// Supabase Edge Function — admin-web-reset-database
//
// DESTRUCTIVE. Empties the environment: every operational table in `public`,
// every auth.users row that isn't a super-admin, and every object in the
// storage buckets. Survivors are DATA in public.admin_reset_preserve
// (read at run time by admin_reset_database) — today: super_admins + their
// auth accounts, the app_config admin-config singleton (Atlas/Intaker/
// Memo/Sourcing/Scoring/Reservations/Promos/Models/Agents/Verification),
// consumer_code_counter, and the re-seeded vocabularies (classes,
// consumer_plans, project_plans, place_categories, place_super_categories,
// place_tags).
//
// RE-SEEDED MEANS IDENTITY ONLY. classes converge on label + rank, the two
// plan catalogs on label. Tuned values — thresholds, limits, weights, prices,
// currency, stripe_price_id — are written on INSERT only, because those tables
// are preserved and an upsert over a live row is a rollback to whenever the
// function's literals were last edited (MESITA-1179). So a reset does NOT
// restore factory thresholds or prices: a drifted one is a migration, never a
// trip through this button.
//
// Three guards before anything runs:
//   1. Caller's JWT identity — email OR phone — must be in
//      public.super_admins.
//   2. Body must carry { confirm: "RESET" } — a typed phrase so a stray
//      click or replayed request can't trigger a wipe.
//   3. In SQL: an EMPTY public.super_admins refuses the wipe outright. The
//      auth.users delete is keyed on that table, so an empty one deletes every
//      account including the operator's, and nothing can re-grant admin
//      afterwards because granting runs through checkSuperAdmin (MESITA-1192).
//
// The DB half lives in the public.admin_reset_database() SQL function
// (security definer, service-role only), which discovers the tables to
// truncate at run time rather than from a hand-kept list.
//
// Storage: purged HERE, not in SQL. Deleting storage.objects rows over SQL
// removes the metadata and strands the underlying file, so the purge has to
// go through the Storage API — see _shared/storage-purge.ts. It runs AFTER
// the DB wipe commits: that way a storage failure leaves recoverable orphans
// (re-run the reset) instead of live rows pointing at deleted images.
//
// ONE CALL IS NOT THE WHOLE JOB. The DB wipe is a single fast statement, but
// the purge is thousands of HTTP deletes — more than the caller's request
// budget allows, and growing with the catalog. So the purge runs to a time
// budget and reports what's left:
//
//   { confirm: "RESET" }                     wipe the DB, then purge a slice
//   { confirm: "RESET", storageOnly: true }  purge the next slice
//
// The caller repeats the second form until `storage_done`. Resuming is safe
// by construction: the lister only ever returns objects that are still there,
// so a continuation can't double-delete or skip. `storageOnly` never touches
// the DB, so a stuck purge can also be drained later without re-wiping.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { purgeStorageObjects } from "../_shared/storage-purge.ts";

type Body = { confirm?: string; storageOnly?: boolean };

const CONFIRM_PHRASE = "RESET";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);

  // --- Guard 1: super_admins gate. ---
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  // --- Guard 2: typed confirmation phrase. ---
  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  if (body.confirm !== CONFIRM_PHRASE) {
    return json(
      { ok: false, error: `confirm must equal "${CONFIRM_PHRASE}"` },
      400,
    );
  }

  // --- Delegate the DB wipe to the locked-down SQL function. ---
  // Skipped on a continuation: the tables are already empty, and re-running
  // the wipe would delete anything the operator created since.
  let result: Record<string, unknown> = {};
  if (!body.storageOnly) {
    const { data, error } = await admin.rpc("admin_reset_database");
    if (error) {
      return json({ ok: false, error: `reset_failed: ${error.message}` }, 500);
    }
    result = (data ?? {}) as Record<string, unknown>;
  }

  // --- Then collect the media the wipe orphaned, for one budget's worth. ---
  const purge = await purgeStorageObjects(admin);
  if (purge.error) {
    console.error("[admin-web-reset-database] storage_purge:", purge.error);
  }

  return json({
    ok: true,
    result: {
      ...result,
      purged_storage_objects: purge.purged,
      remaining_storage_objects: purge.remaining,
      storage_done: purge.done,
      storage_purge_error: purge.error,
    },
  });
});
