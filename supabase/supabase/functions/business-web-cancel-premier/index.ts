// Supabase Edge Function — business-web-cancel-premier
//
// MESITA-3103. Two stops:
//   default    the caller stops renewing the subscription they pay
//              (`cancelPremier`, as the guest's tab does). It reads only the
//              caller's own pledge, so it asks for no place access
//              (MESITA-3130): a payer who left the place, was removed, handed
//              it over or let the claim expire can still stop paying.
//   as_place   whoever runs the place stops the subscription a guest pays
//              (`stopPremierAsPlace`, ended reason `stopped_by_place`). The
//              paid period runs out, nothing renews it, the payer's card is
//              detached, and the payer sees why on their Premier tab. Owner
//              or Mesita staff only.
//
// Body: { place_id?: uuid, backing_id?: uuid, as_place?: boolean } — the
//   payer's stop names the place or the subscription; as_place needs place_id.
// Response: { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { canManage, ownerOnly, requirePlaceAccess } from "../_shared/place-access.ts";
import { cancelPremier, stopPremierAsPlace } from "../_shared/premier-flow.ts";

serveJson("business-web-cancel-premier", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  const backingId = bodyRes.body.backing_id;

  // The payer's own renewal (MESITA-3130): cancelPremier finds only a pledge
  // whose consumer_id is the caller, and 404s anything else.
  if (bodyRes.body.as_place !== true) {
    if (isUuid(backingId)) return await cancelPremier(env, user.id, { backingId });
    if (!isUuid(placeId)) return json({ ok: false, error: "place_id or backing_id must be a Mesita id" }, 400);
    return await cancelPremier(env, user.id, { placeId });
  }

  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;
  // Stopping a guest's Premier is the owner's (MESITA-3120): editors see it, never stop it.
  if (!canManage(access.role)) return ownerOnly();
  return await stopPremierAsPlace(env, placeId, user.id);
});
