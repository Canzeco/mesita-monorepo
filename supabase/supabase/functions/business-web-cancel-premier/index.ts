// Supabase Edge Function — business-web-cancel-premier
//
// MESITA-3103. Two stops:
//   default    the caller stops renewing the subscription they pay
//              (`cancelPremier`, as the guest's tab does);
//   as_place   whoever runs the place stops the subscription a guest pays
//              (`stopPremierAsPlace`, ended reason `stopped_by_place`). The
//              paid period runs out, nothing renews it, the payer's card is
//              detached, and the payer sees why on their Premier tab.
//
// Body: { place_id: uuid, as_place?: boolean }
// Response: { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { cancelPremier, stopPremierAsPlace } from "../_shared/premier-flow.ts";

serveJson("business-web-cancel-premier", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  if (bodyRes.body.as_place === true) return await stopPremierAsPlace(env, placeId, user.id);
  return await cancelPremier(env, user.id, { placeId });
});
