// Supabase Edge Function — admin-web-update-place-reviews (MESITA-3159)
//
// Super-admin only. Update Reviews for one place, from Manage Multiple's
// Update Reviews box: Google stars and count, the Apify review list,
// Instagram and Facebook followers (`_shared/reviews-update.ts`, one body
// with the Business app's Reviews Sync and the every-N-views trigger).
// Audited as an operator "update" event.
//
// Body: { placeId: uuid }
// Response: { ok: true, placeId, lastSyncedAt } | { ok: false, error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, readPlaceIdAlias, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/request.ts";
import { runReviewsUpdate } from "../_shared/reviews-update.ts";
import { recordAdminOperatorEvent } from "../_shared/admin-operator-events.ts";

serveJson("admin-web-update-place-reviews", async (req) => {
  const ctx = await requireAdminRequest(req, "Only admins can update reviews.");
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<{ placeId?: string; projectId?: string }>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const result = await runReviewsUpdate(admin, placeId);
  await recordAdminOperatorEvent(admin, {
    verb: "update",
    outcome: result.ok ? "succeeded" : "failed",
    placeId,
    actorUserId: user.id,
    source: "admin-web-update-place-reviews",
    detail: result.ok ? { kind: "reviews" } : { kind: "reviews", error: result.error },
  });
  if (!result.ok) return json({ ok: false, error: result.error }, result.status);
  return json({ ok: true, placeId, lastSyncedAt: result.synced.lastSyncedAt });
});
