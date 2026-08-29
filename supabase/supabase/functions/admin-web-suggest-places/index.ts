// Supabase Edge Function — admin-web-suggest-places (product caller)
//
// Manage Single Place name bar. Same Name Deep Search engine as consumer
// Search (`runConsumerSearchLane`, mode deep): Autocomplete + Text Search
// + Lineup Name, then Partners → Mesita → Google after dropping overlaps.
// Super-admin gated.
//
// Auth: caller's JWT email must be in public.super_admins.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { runConsumerSearchLane } from "../_shared/consumer-search-lane.ts";

type Body = {
  input?: string;
  sessionToken?: string;
  regionCode?: string;
  country?: string;
  mode?: string;
};

Deno.serve(async (req) => {
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

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const body = bodyRes.body;
  const country = (body.country ?? body.regionCode ?? "").toString().trim();

  return await runConsumerSearchLane(env, "admin-web-suggest-places", {
    input: body.input,
    sessionToken: body.sessionToken,
    country: country.length === 2 ? country : null,
    mode: typeof body.mode === "string" ? body.mode : "deep",
  });
});
