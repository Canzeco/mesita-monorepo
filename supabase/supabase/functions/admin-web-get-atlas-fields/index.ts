// Supabase Edge Function — admin-web-get-atlas-fields
//
// Read-only Intaker vocabulary for the admin console: Super Categories,
// place categories, tag catalog, tag facets, and enforced field length limits.
// Twin of `business-web-get-atlas-fields`; both are a guard plus
// `_shared/atlas-fields.ts` (MESITA-1740).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { loadAtlasFields } from "../_shared/atlas-fields.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const saRes = await requireSuperAdmin(admin, authRes.user);
  if (!saRes.ok) return saRes.response;

  const payload = await loadAtlasFields(admin);
  return json({ ok: true, ...payload });
});
