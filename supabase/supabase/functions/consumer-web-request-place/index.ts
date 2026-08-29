// Supabase Edge Function — consumer-web-request-place
//
// Signed-in consumer requests a usable Mesita profile for a Listed place
// that is not yet Enriched. One request per consumer per place. When the
// count reaches Intake atlasRequestThreshold, seed the existing Intaker
// pipeline. Admin create/enrich never goes through this door.
//
// Local:  supabase functions serve consumer-web-request-place
// Deploy: supabase functions deploy consumer-web-request-place

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
import { applyPlaceRequest } from "../_shared/place-requests.ts";

type Body = {
  placeId?: string;
  projectId?: string;
  place_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;
  const consumerId = authRes.user.id;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body) ||
    (typeof bodyRes.body.place_id === "string" ? bodyRes.body.place_id.trim() : "");
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);
  const result = await applyPlaceRequest(admin, {
    consumerId,
    placeId,
    callerName: "consumer-web-request-place",
  });
  if (!result.ok) {
    return json(
      { ok: false, error: result.error, code: result.code ?? null },
      result.status,
    );
  }
  return json({ ok: true, ...result.state });
});
