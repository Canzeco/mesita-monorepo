// Supabase Edge Function — business-web-transfer-owner
//
// MESITA-3120. The owner (or Mesita staff) makes one of the place's live
// editors its owner; the old owner stays on as an editor. One owner per place
// holds throughout (place_transfer_owner, under the place lock).
//
// Body: { place_id: uuid, manager_id: uuid }
// Response: { ok: true }   409 not_an_editor · 403 owner_only

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";

serveJson("business-web-transfer-owner", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, manager_id: managerId } = bodyRes.body;
  if (!isUuid(placeId) || !isUuid(managerId)) return json({ ok: false, error: "place_id and manager_id are required" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const { data, error } = await admin.rpc("place_transfer_owner", { p_place_id: placeId, p_to_manager_id: managerId });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (data !== true) return json({ ok: false, code: "not_an_editor", error: "Only a live editor can become the owner" }, 409);
  return json({ ok: true });
});
