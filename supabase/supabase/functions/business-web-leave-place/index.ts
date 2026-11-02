// Supabase Edge Function — business-web-leave-place
//
// MESITA-3103. The caller stops running a place: their own row is revoked.
// Settings › "Remove this place from my account". They can claim it again.
//
// Body: { place_id: uuid }
// Response: { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("business-web-leave-place", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const { data, error } = await admin
    .from("place_managers")
    .update({ revoked_at: new Date().toISOString(), revoked_by: "self", updated_at: new Date().toISOString() })
    .eq("place_id", placeId)
    .eq("consumer_id", user.id)
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!data) return json({ ok: false, code: "not_found", error: "Place not found" }, 404);
  return json({ ok: true });
});
