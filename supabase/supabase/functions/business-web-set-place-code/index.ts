// Supabase Edge Function — business-web-set-place-code
//
// MESITA-3226 (on Payments since MESITA-3600, Settings before): the waiter code, six digits
// staff type at visit.mesita.ai. Only the hash is stored, so it is never shown
// again and a forgotten one is replaced. The owner and Mesita staff only.
//
// Body: { place_id: uuid, code: "123456" }
// Response: { ok: true, code_set: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { hashPlaceCode, readPlaceCode } from "../_shared/place-code.ts";

serveJson("business-web-set-place-code", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const code = readPlaceCode(bodyRes.body.code);
  if (!code) return json({ ok: false, code: "invalid", error: "The code is six digits" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  const { error } = await admin.from("place_codes").upsert({
    place_id: placeId,
    code_hash: await hashPlaceCode(placeId, code),
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });
  if (error) return json({ ok: false, error: `place_codes: ${error.message}` }, 500);
  return json({ ok: true, code_set: true });
});
