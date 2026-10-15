// Supabase Edge Function — admin-web-set-category-families
//
// Writes the category ↔ family dictionary only. Places are not rewritten.
// Catalog membership is derived from this table.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { corsPreflight, json, readJson, rejectUnlessMethods } from "../_shared/http.ts";
import { adminClient, getAuthedUser, readEFEnv, requireSuperAdmin } from "../_shared/auth.ts";
import { normalizeCategoryFamilies } from "../_shared/category-families.ts";
import { fetchPlaceFamilies } from "../_shared/categories.ts";

type Body = { slug?: string; familyKeys?: unknown };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return corsPreflight();
  const methodReject = rejectUnlessMethods(req, "POST");
  if (methodReject) return methodReject;

  const envRes = readEFEnv();
  if (!envRes.ok) return envRes.response;
  const authRes = await getAuthedUser(req, envRes.env);
  if (!authRes.ok) return authRes.response;

  const admin = adminClient(envRes.env);
  const guard = await requireSuperAdmin(admin, authRes.user, "Only admins can edit Atlas.");
  if (!guard.ok) return guard.response;

  const bodyRes = await readJson<Body>(req);
  if (!bodyRes.ok) return bodyRes.response;
  const slug = (bodyRes.body.slug ?? "").trim();
  if (!slug) return json({ ok: false, error: "Missing slug" }, 400);

  const families = await fetchPlaceFamilies(admin);
  const normalized = normalizeCategoryFamilies(
    bodyRes.body.familyKeys,
    families.map((row) => row.slug),
  );
  if (!normalized.ok) return json({ ok: false, error: normalized.error }, 400);

  const { data, error } = await admin
    .from("place_categories")
    .update({ family_keys: normalized.keys })
    .eq("slug", slug)
    .select("slug")
    .maybeSingle();
  if (error) return json({ ok: false, error: error.message }, 500);
  if (!data) return json({ ok: false, error: "Category not found" }, 404);
  return json({ ok: true, slug, familyKeys: normalized.keys });
});
