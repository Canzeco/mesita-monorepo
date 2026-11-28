// Supabase Edge Function — consumer-web-track-share-open
//
// MESITA-5060: someone opened a link that carried a share code. Public: the
// friend who opens it usually has no account yet. One row per code × place ×
// browser (`visitor`, a random id the browser made); a repeat does nothing.
// An unknown code or place is not an error to the visitor: it answers ok and
// records nothing.
//
// Body: { code: string, visitor: string, place?: uuid | slug }
// Response: { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJson, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isPlaceRef, isShareCode, isVisitorId } from "../_shared/share-codes.ts";
import { resolvePlaceRef } from "../_shared/share-place-ref.ts";

serveJson("consumer-web-track-share-open", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { code, visitor, place } = bodyRes.body;
  if (!isShareCode(code)) return json({ ok: false, error: "code must be a share code" }, 400);
  if (!isVisitorId(visitor)) return json({ ok: false, error: "visitor must be a browser id" }, 400);
  if (place != null && !isPlaceRef(place)) return json({ ok: false, error: "place must be a place id or slug" }, 400);

  const placeId = await resolvePlaceRef(admin, (place as string | undefined) ?? null);
  if (place != null && !placeId) return json({ ok: true }); // a place that is gone

  const { error } = await admin.from("share_opens").insert({ code, visitor, place_id: placeId });
  // 23505: this browser already opened this code's link to this place.
  // 23503: no such code.
  if (error && error.code !== "23505" && error.code !== "23503") {
    return json({ ok: false, error: `share_opens: ${error.message}` }, 500);
  }
  return json({ ok: true });
});
