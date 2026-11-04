// Supabase Edge Function — consumer-web-skip-task
//
// MESITA-3270: the shared visit, Task, the guest's half. No story today, so the Story
// row drops off and the visit moves to Pay. A Story staff already saw stays.
//
// Body: { place_id: uuid }
// Response: { ok: true, visit: { ...the open visit } | null }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";

serveJson("consumer-web-skip-task", async (req) => {
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
  const { data, error } = await admin.rpc("place_visit_skip_task", {
    p_place_id: placeId,
    p_consumer_id: authRes.user.id,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (data?.outcome !== "ok") return json({ ok: true, visit: null });
  const { outcome: _outcome, ...visit } = data;
  return json({ ok: true, visit });
});
