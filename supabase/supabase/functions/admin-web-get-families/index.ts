// Supabase Edge Function — admin-web-get-families
//
// Read-only taxonomy for Configurations › Atlas. One caller: that page.
// Families, categories and tags are the live tables. Google types are the
// code map, returned here so the console does not keep a second copy.

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
  fetchPlaceFamilies,
} from "../_shared/categories.ts";
import { buildFamiliesMap } from "../_shared/families-map.ts";
import { fetchPlaceTags } from "../_shared/tags.ts";

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

  const [categories, families, tags] = await Promise.all([
    fetchPlaceCategories(admin),
    fetchPlaceFamilies(admin),
    fetchPlaceTags(admin),
  ]);
  return json({ ok: true, ...buildFamiliesMap(families, categories, tags) });
});
