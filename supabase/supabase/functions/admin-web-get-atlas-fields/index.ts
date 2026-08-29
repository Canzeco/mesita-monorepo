// Supabase Edge Function — admin-web-get-atlas-fields
//
// Read-only Intaker vocabulary for the admin console: Super Categories,
// place categories, tag catalog, tag facets, and enforced field length limits.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  fetchPlaceCategories,
  fetchPlaceSuperCategories,
} from "../_shared/categories.ts";
import { ENRICH_FIELD_LIMITS } from "../_shared/enrich-field-limits.ts";
import { fetchPlaceTags, TAG_FACETS } from "../_shared/tags.ts";

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

  const [categories, superCategories, tags] = await Promise.all([
    fetchPlaceCategories(admin),
    fetchPlaceSuperCategories(admin),
    fetchPlaceTags(admin),
  ]);

  return json({
    ok: true,
    categories,
    superCategories,
    tags,
    facets: TAG_FACETS,
    fieldLimits: ENRICH_FIELD_LIMITS,
    counts: {
      categories: categories.length,
      superCategories: superCategories.length,
      tags: tags.length,
      facets: TAG_FACETS.length,
    },
  });
});
