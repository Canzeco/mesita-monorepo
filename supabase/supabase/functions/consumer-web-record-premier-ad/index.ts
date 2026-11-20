// Supabase Edge Function — consumer-web-record-premier-ad
//
// MESITA-4460. Home and the Map report an ad slot that reached the screen
// (impression) or a guest who opened it (tap). One call, one counter step.
// The function ignores a place that is not on a paid Premier plan.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, readJsonOr, serveJson } from "../_shared/http.ts";
import { openRequest } from "../_shared/request.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("consumer-web-record-premier-ad", async (req) => {
  const ctx = openRequest(req);
  if (ctx instanceof Response) return ctx;
  const body = await readJsonOr<{ place_id?: unknown; kind?: unknown }>(req, {});
  const placeId = body.place_id;
  const kind = body.kind;
  if (!isUuid(placeId) || (kind !== "impression" && kind !== "tap")) {
    return json({ ok: true, ignored: true });
  }
  const { error } = await ctx.admin.rpc("record_premier_ad", { p_place: placeId, p_kind: kind });
  if (error) {
    console.error("[premier-ad]", error.message);
    return json({ ok: false, error: "could not record the ad" }, 500);
  }
  return json({ ok: true });
});
