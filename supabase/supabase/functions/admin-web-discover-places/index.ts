// Supabase Edge Function — admin-web-discover-places (product caller)
//
// Thin facade for the admin bulk-search UI. Gates the request to
// super_admins, then forwards the query batch to the supabase-edgefunc-discover-places
// internal caller for the actual Google fan-out + Mesita enrichment.
//
// Auth: caller's JWT email must be in public.super_admins. verify_jwt = true
// at the gateway gates the request to a real session before we even see it.
//
// Wire status follows the standard admin EF contract: 403 when the caller
// is not on public.super_admins. efInvoke surfaces the error body to the UI.
// A 400/404/422 from the internal caller (a bad batch) passes through with
// its error; any other failure, including an internal 401/403 or a network
// error, is 502, so an internal auth refusal never reads as the admin's own
// session failing. invokeInternalCaller carries no `code` (MESITA-2855).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { invokeInternalCaller } from "../_shared/internal.ts";

type RequestBody = {
  queries?: string[];
  placeIds?: string[];
  regionCode?: string;
  maxResultsPerQuery?: number;
};

const FORWARDED_STATUSES = new Set([400, 404, 422]);

serveJson("admin-web-discover-places", async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const env = envRes.env;

  const authRes = await getAuthedUser(req, env);
  if (!authRes.ok) return authRes.response;
  const admin = adminClient(env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const bodyRes = await readJson<RequestBody>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;

  // Forward only operational search params. Quality floors live on
  // Discovery › Map and are read inside the internal caller — never
  // from this body. Named Place IDs are not exempt.
  const result = await invokeInternalCaller(
    env,
    "admin-web-discover-places",
    "supabase-edgefunc-discover-places",
    {
      queries: body.queries,
      placeIds: body.placeIds,
      regionCode: body.regionCode,
      maxResultsPerQuery: body.maxResultsPerQuery,
    },
  );
  if (!result.ok) {
    const status = FORWARDED_STATUSES.has(result.status) ? result.status : 502;
    return json({ ok: false, error: result.error }, status);
  }
  return json(result.data);
});
