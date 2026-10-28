// Supabase Edge Function — admin-web-get-families
//
// Read-only taxonomy for Configurations › Atlas. One caller: that page.
// The Mesita Families, every Google category split into enabled and not
// enabled on Mesita, and the tag catalog — all live tables (MESITA-2891).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, rejectUnlessMethods } from "../_shared/http.ts";
import {
  adminClient,
  getAuthedUser,
  readEFEnv,
  requireSuperAdmin,
} from "../_shared/auth.ts";
import {
  fetchGoogleCategories,
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

  const [googleCategories, families, tags] = await Promise.all([
    fetchGoogleCategories(admin),
    fetchPlaceFamilies(admin),
    fetchPlaceTags(admin),
  ]);
  if (googleCategories.length === 0 || families.length === 0) {
    return json({ ok: false, error: "Atlas vocabulary unavailable" }, 500);
  }
  return json({ ok: true, ...buildFamiliesMap(families, googleCategories, tags) });
});
