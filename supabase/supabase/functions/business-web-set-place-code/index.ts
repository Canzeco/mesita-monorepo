// Supabase Edge Function — business-web-set-place-code
//
// MESITA-3226 (on Payments since MESITA-3600, Settings before): the waiter code, six digits
// waiters type at service.mesita.ai. MESITA-4827: Mesita makes it (an owner-typed
// one would read "taken" and reveal another place's code), shows it once and
// stores only hashes; a forgotten one is replaced. The owner and Mesita staff only.
//
// Body: { place_id: uuid }
// Response: { ok: true, code_set: true, code: "123456" }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";
import { hashPlaceCode, lookupPlaceCode, mintPlaceCode } from "../_shared/place-code.ts";

serveJson("business-web-set-place-code", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  if (!canManage(access.role)) return ownerOnly();

  // A code is one place's: a collision draws again.
  for (let i = 0; i < 5; i++) {
    const code = mintPlaceCode();
    const { error } = await admin.from("place_codes").upsert({
      place_id: placeId,
      code_hash: await hashPlaceCode(placeId, code),
      lookup_hash: await lookupPlaceCode(env.serviceKey, code),
      updated_at: new Date().toISOString(),
      updated_by: user.id,
    });
    if (!error) return json({ ok: true, code_set: true, code });
    if (error.code !== "23505") return json({ ok: false, error: `place_codes: ${error.message}` }, 500);
  }
  return json({ ok: false, error: "Couldn't make a code. Try again." }, 500);
});
