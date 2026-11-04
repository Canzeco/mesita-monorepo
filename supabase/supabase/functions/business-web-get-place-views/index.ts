// Supabase Edge Function — business-web-get-place-views
//
// MESITA-3206: Business › Views. How many signed-in guests viewed, liked and
// shared this place. Each is people, not taps. A failed count is an error here,
// never a false 0: an owner reads these numbers as fact.
//
// Body: { place_id: uuid }
// Response: { ok: true, views: number, likes: number, shares: number }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { requireBusinessRequest } from "../_shared/business-request.ts";
import { requirePlaceAccess } from "../_shared/place-access.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("business-web-get-place-views", async (req) => {
  const ctx = await requireBusinessRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin, user } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const access = await requirePlaceAccess(admin, user, placeId);
  if (access instanceof Response) return access;

  const activity = (kind: "viewed" | "saved") =>
    admin.from("place_activity").select("*", { count: "exact", head: true }).eq("place_id", placeId).eq("kind", kind);
  const [views, likes, shares] = await Promise.all([
    activity("viewed"),
    activity("saved"),
    admin.from("place_shares").select("*", { count: "exact", head: true }).eq("place_id", placeId),
  ]);
  const failed = views.error ?? likes.error ?? shares.error;
  if (failed) return json({ ok: false, error: failed.message }, 500);

  return json({ ok: true, views: views.count ?? 0, likes: likes.count ?? 0, shares: shares.count ?? 0 });
});
