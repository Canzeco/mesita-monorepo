// Supabase Edge Function — admin-web-get-atlas-fields
//
// Read-only Enricher vocabulary for the admin console: Families,
// place categories, tag catalog, tag facets, and enforced field length limits.
// Nothing here is place-specific or private — it is the catalog the Profile
// editor reads to enforce its caps.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods, serveJson } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import { fetchPlaceCategories, fetchPlaceFamilies } from "../_shared/categories.ts";
import { ENRICH_FIELD_LIMITS } from "../_shared/enrich-field-limits.ts";
import { fetchPlaceTags, TAG_FACETS } from "../_shared/tags.ts";

serveJson("admin-web-get-atlas-fields", async (req) => {
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

  const [categories, families, tags] = await Promise.all([
    fetchPlaceCategories(admin),
    fetchPlaceFamilies(admin),
    fetchPlaceTags(admin),
  ]);
  return json({
    ok: true,
    categories,
    families,
    tags,
    facets: TAG_FACETS,
    fieldLimits: ENRICH_FIELD_LIMITS,
  });
});
