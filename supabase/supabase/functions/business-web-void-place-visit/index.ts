// Supabase Edge Function — business-web-void-place-visit
//
// MESITA-3202: Business › Visits, Void. A mistake is voided, never deleted. The
// owner and Mesita staff only. Voiding again changes nothing.
//
// Body: { place_id: uuid, visit_id: uuid }
// Response: { ok: true, voided_at }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("business-web-void-place-visit", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, visit_id: visitId } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (!isUuid(visitId)) return json({ ok: false, error: "visit_id must be a uuid" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const { data, error } = await admin.rpc("place_visit_void", {
    p_place_id: placeId,
    p_visit_id: visitId,
    p_voided_by: user.id,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (data?.outcome !== "ok") return json({ ok: false, code: "not_found", error: "Visit not found" }, 404);
  console.log(JSON.stringify({ fn: "business-web-void-place-visit", place_id: placeId, visit_id: visitId }));
  return json({ ok: true, voided_at: data.visit?.voided_at ?? null });
});
