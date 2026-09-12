// Supabase Edge Function — business-web-get-atlas-fields
//
// The operator's door onto the Intaker vocabulary the Profile editor needs:
// Super Categories, place categories, the tag catalog and facets, and the
// enforced field limits. Twin of `admin-web-get-atlas-fields`; both are a
// guard plus `_shared/atlas-fields.ts` (MESITA-1740).
//
// Nothing here is place-specific or private. Auth is a signed-in caller —
// the same bar as opening the console. A membership check would lock the
// picker on a pool place the operator is claiming, which is the surface
// that needs the catalog most.
//
// Body:     {}
// Response: { ok: true, categories, superCategories, tags, facets, fieldLimits, counts }
//
// Local:  supabase functions serve business-web-get-atlas-fields
// Deploy: supabase functions deploy business-web-get-atlas-fields

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv } from "../_shared/auth.ts";
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
  const payload = await loadAtlasFields(admin);
  return json({ ok: true, ...payload });
});
