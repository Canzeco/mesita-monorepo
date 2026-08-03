// Supabase Edge Function — admin-web-reset-database
//
// DESTRUCTIVE. Empties the environment: every operational table in `public`,
// every auth.users row that isn't a super-admin, and every object in the
// storage buckets. Preserves public.super_admins (and their auth accounts),
// the app_settings config singleton, and the re-seeded vocabularies
// (classes, business_plans, place_categories, place_tags).
//
// Two guards before anything runs:
//   1. Caller's JWT identity — email OR phone — must be in
//      public.super_admins.
//   2. Body must carry { confirm: "RESET" } — a typed phrase so a stray
//      click or replayed request can't trigger a wipe.
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

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { purgeStorageObjects } from "../_shared/storage-purge.ts";

type Body = { confirm?: string };

const CONFIRM_PHRASE = "RESET";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

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
  const { data, error } = await admin.rpc("admin_reset_database");
  if (error) {
    return json({ ok: false, error: `reset_failed: ${error.message}` }, 500);
  }

  // --- Then collect the media the wipe just orphaned. ---
  const purge = await purgeStorageObjects(admin);
  if (purge.error) {
    console.error("[admin-web-reset-database] storage_purge:", purge.error);
  }

  const result = (data ?? {}) as Record<string, unknown>;
  return json({
    ok: true,
    result: {
      ...result,
      purged_storage_objects: purge.purged,
      storage_purge_error: purge.error,
    },
  });
});
