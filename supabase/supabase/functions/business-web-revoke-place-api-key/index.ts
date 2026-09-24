// Supabase Edge Function — business-web-revoke-place-api-key
//
// Owner-only. Soft-revokes one key on a place.
// Body: { placeId, keyId }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJson,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireOwner,
} from "../_shared/auth.ts";

type Body = {
  placeId?: string;
  projectId?: string;
  keyId?: string;
  key_id?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const placeId = readPlaceIdAlias(bodyRes.body);
  const keyId = bodyRes.body.keyId ?? bodyRes.body.key_id;
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);
  if (!keyId || typeof keyId !== "string") {
    return json({ ok: false, error: "keyId is required" }, 400);
  }

  const admin = adminClient(envRes.env);
  const ownerRes = await requireOwner(admin, authRes.user, placeId);
  if (!ownerRes.ok) return ownerRes.response;

  const { data, error } = await admin
    .from("place_api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("place_id", placeId)
    .is("revoked_at", null)
    .select("id, key_prefix, label, revoked_at")
    .maybeSingle();

  if (error) return json({ ok: false, error: error.message }, 500);
  if (!data) {
    return json({ ok: false, error: "Key not found or already revoked" }, 404);
  }
  return json({ ok: true, key: data });
});
