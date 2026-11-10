// Supabase Edge Function — business-web-get-premier
//
// MESITA-3103. The place's Premier as its Business page shows it
// (`_shared/premier-flow.ts` readPremier, the guest's read until MESITA-3168),
// for whoever runs the place or a super-admin. With `session_id` (Checkout's
// return) it first settles the caller's own pledge.
//
// Body: { place_id: uuid, session_id?: string }
// Response: readPremier's body + { role }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { readPremier } from "../_shared/premier-flow.ts";

serveJson("business-web-get-premier", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { env, admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  const sessionId = typeof bodyRes.body.session_id === "string" ? bodyRes.body.session_id : null;

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  const res = await readPremier(env, user, placeId, sessionId);
  if (!res.ok) return res;
  const body = await res.json();
  return json({ ...body, role: access.role });
});
