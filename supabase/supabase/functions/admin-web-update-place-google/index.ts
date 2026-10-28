// Supabase Edge Function — admin-web-update-place-google (MESITA-2737)
//
// Super-admin only. Refreshes Google factuals for one place, and the gallery's
// hero only while the gallery is one photo (MESITA-2794). Respects field pins.
// Does not enqueue Enrich. Audited via source_sync.lastGoogleUpdateAt.
//
// Local:  supabase functions serve admin-web-update-place-google
// Deploy: supabase functions deploy admin-web-update-place-google

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  json,
  readJson,
  readPlaceIdAlias,
  serveJson,
} from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import { runGooglePlaceUpdate } from "../_shared/admin-google-place-update.ts";
import { recordAdminOperatorEvent } from "../_shared/admin-operator-events.ts";

type Body = { placeId?: string; projectId?: string };

serveJson("admin-web-update-place-google", async (req) => {
  const ctx = await requireAdminRequest(req, "POST", "Only admins can update Google data.");
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const result = await runGooglePlaceUpdate(admin, placeId, {
    supabaseUrl: env.url,
  });
  if (!result.ok) {
    await recordAdminOperatorEvent(admin, {
      verb: "update",
      outcome: "failed",
      placeId,
      actorUserId: user.id,
      source: "admin-web-update-place-google",
      detail: { error: result.error, code: result.code ?? null },
    });
    return json(
      { ok: false, error: result.error, ...(result.code ? { code: result.code } : {}) },
      result.status,
    );
  }

  await recordAdminOperatorEvent(admin, {
    verb: "update",
    outcome: "succeeded",
    placeId,
    actorUserId: user.id,
    source: "admin-web-update-place-google",
    detail: { heroRefreshed: result.heroRefreshed },
  });

  return json({
    ok: true,
    placeId,
    updatedAt: result.updatedAt,
    heroRefreshed: result.heroRefreshed,
    pinned: result.pinned,
    businessStatus: result.businessStatus,
  });
});
