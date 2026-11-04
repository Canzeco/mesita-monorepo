// Supabase Edge Function — visit-web-set-task
//
// MESITA-3270: the shared visit, Task, staff's half. Staff saw the guest's Instagram
// Story (it counts) or there is none (it doesn't). Nothing in the app can see the
// post, so a person looking at it is the proof. No sign-in. The guest holds the same
// link, so the place code is what proves this is the place.
//
// Body: { place_id: uuid, code: "<32 hex>", place_code: "123456", seen: boolean }
// Response: { ok: true, ...the open visit } | { ok: false, code, error }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import { adminClient, readEFEnv } from "../_shared/auth.ts";
import { isUuid } from "../_shared/place-id.ts";
import { hashPlaceCode, hashVisitCode, readPlaceCode, readVisitCode, VISIT_REFUSED } from "../_shared/place-visits.ts";

serveJson("visit-web-set-task", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;

  const bodyRes = await readJson<Record<string, unknown>>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const { place_id: placeId, seen } = bodyRes.body;
  if (!isUuid(placeId)) return json({ ok: false, error: "place_id must be a Mesita place id" }, 400);
  if (typeof seen !== "boolean") return json({ ok: false, error: "seen must be true or false" }, 400);
  const code = readVisitCode(bodyRes.body.code);
  if (!code) return json({ ok: false, code: "bad_code", error: VISIT_REFUSED.bad_code }, 409);
  const placeCode = readPlaceCode(bodyRes.body.place_code);
  if (!placeCode) return json({ ok: false, code: "bad_place_code", error: "The place code is six digits." }, 400);

  const admin = adminClient(envRes.env);
  const { data, error } = await admin.rpc("place_visit_set_task", {
    p_place_id: placeId,
    p_code_hash: await hashVisitCode(placeId, code),
    p_place_code_hash: await hashPlaceCode(placeId, placeCode),
    p_seen: seen,
  });
  if (error) return json({ ok: false, error: error.message }, 500);
  if (data?.outcome !== "ok") {
    const outcome = String(data?.outcome);
    return json({ ok: false, code: outcome, error: VISIT_REFUSED[outcome] ?? "Couldn't save that." }, 409);
  }
  const { outcome: _outcome, ...visit } = data;
  return json({ ok: true, ...visit });
});
