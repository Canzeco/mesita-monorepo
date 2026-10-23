// Supabase Edge Function — admin-web-update-place-google (MESITA-2737)
//
// Super-admin only. Refreshes Google factuals and google_photos for one place.
// Respects field pins; never writes mesita_photos, legacy photos, or Mesita hero.
// Does not enqueue Enrich. Audited via source_sync.lastGoogleUpdateAt.
//
// Local:  supabase functions serve admin-web-update-place-google
// Deploy: supabase functions deploy admin-web-update-place-google

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { runGooglePlaceUpdate } from "../_shared/admin-google-place-update.ts";

type Body = { placeId?: string; projectId?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const guard = await requireSuperAdmin(admin, authRes.user, "Only admins can update Google data.");
  if (!guard.ok) return guard.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const result = await runGooglePlaceUpdate(admin, placeId, {
    supabaseUrl: envRes.env.url,
  });
  if (!result.ok) {
    return json(
      { ok: false, error: result.error, ...(result.code ? { code: result.code } : {}) },
      result.status,
    );
  }

  return json({
    ok: true,
    placeId,
    updatedAt: result.updatedAt,
    googlePhotoCount: result.googlePhotoCount,
    pinned: result.pinned,
    businessStatus: result.businessStatus,
  });
});
