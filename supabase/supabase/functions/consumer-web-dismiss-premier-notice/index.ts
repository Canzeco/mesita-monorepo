// Supabase Edge Function — consumer-web-dismiss-premier-notice
//
// MESITA-3092: the Premier tab's "Premier ended …" notice is the caller's
// own ended subscription on that place; dismissing it hides it for them.
// Only the caller's own pledges are touched.
//
// Body: { place_id: uuid }
// Response: { ok: true }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("consumer-web-dismiss-premier-notice", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = bodyRes.body.place_id;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);

  const admin = adminClient(envRes.env);
  const { error } = await admin
    .from("place_backings")
    .update({ notice_dismissed_at: new Date().toISOString() })
    .eq("place_id", placeId)
    .eq("consumer_id", authRes.user.id)
    .eq("status", "ended")
    .is("notice_dismissed_at", null);
  if (error) {
    const requestId = crypto.randomUUID();
    console.error("[premier] dismiss_notice", JSON.stringify({ request_id: requestId, place_id: placeId, error: error.message }));
    return json({ ok: false, error: "Couldn't hide the notice. Try again.", request_id: requestId }, 500);
  }
  return json({ ok: true });
});
