// Supabase Edge Function — business-web-list-place-api-keys
//
// Any place member may list keys (prefix + metadata only — never plaintext).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  corsPreflight,
  json,
  readJsonOr,
  readPlaceIdAlias,
  rejectUnlessMethods,
} from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireMembership,
} from "../_shared/auth.ts";

type Body = { placeId?: string; projectId?: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "GET", "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);
  const memberRes = await requireMembership(admin, authRes.user, placeId);
  if (!memberRes.ok) return memberRes.response;

  const { data, error } = await admin
    .from("place_api_keys")
    .select(
      "id, key_prefix, label, created_at, last_used_at, revoked_at",
    )
    .eq("place_id", placeId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, keys: data ?? [] });
});
