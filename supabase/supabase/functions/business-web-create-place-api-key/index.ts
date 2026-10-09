// Supabase Edge Function — business-web-create-place-api-key
//
// Owner-only. Mints a place-scoped API key. Plaintext returned ONCE.
// Body: { placeId, label?: string, rotate?: boolean }
// rotate=true revokes every active key on the place before minting.

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
  requireOwner,
} from "../_shared/auth.ts";
import { mintPlaceApiKeyPlaintext } from "../_shared/place-api-keys.ts";

type Body = {
  placeId?: string;
  projectId?: string;
  label?: string;
  rotate?: boolean;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const body = await readJsonOr<Body>(req, {});
  const placeId = readPlaceIdAlias(body);
  if (!placeId) return json({ ok: false, error: "placeId is required" }, 400);

  const admin = adminClient(envRes.env);
  const ownerRes = await requireOwner(admin, authRes.user, placeId);
  if (!ownerRes.ok) return ownerRes.response;

  const label =
    typeof body.label === "string" && body.label.trim().length > 0
      ? body.label.trim().slice(0, 80)
      : "Integration";
  const rotate = body.rotate === true;

  if (rotate) {
    const { error: revokeErr } = await admin
      .from("place_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("place_id", placeId)
      .is("revoked_at", null);
    if (revokeErr) {
      return json({ ok: false, error: `revoke: ${revokeErr.message}` }, 500);
    }
  } else {
    const { count, error: countErr } = await admin
      .from("place_api_keys")
      .select("id", { count: "exact", head: true })
      .eq("place_id", placeId)
      .is("revoked_at", null);
    if (countErr) {
      return json({ ok: false, error: `key_count: ${countErr.message}` }, 500);
    }
    if ((count ?? 0) >= 1) {
      return json(
        {
          ok: false,
          error:
            "This place already has an active API key — rotate to replace it",
          code: "place_api_key_exists",
        },
        409,
      );
    }
  }

  const minted = await mintPlaceApiKeyPlaintext();
  const { data, error } = await admin
    .from("place_api_keys")
    .insert({
      place_id: placeId,
      key_prefix: minted.prefix,
      key_hash: minted.hash,
      label,
      created_by: authRes.user.id,
    })
    .select("id, key_prefix, label, created_at")
    .single();

  if (error) {
    return json({ ok: false, error: `key_insert: ${error.message}` }, 500);
  }

  return json({
    ok: true,
    key: {
      id: data.id,
      token: minted.plaintext,
      key_prefix: data.key_prefix,
      label: data.label,
      created_at: data.created_at,
    },
  });
});
