// Supabase Edge Function — admin-web-get-families
//
// Read-only taxonomy for Configurations › Atlas. One caller: that page.
// The Mesita Families, every Google category split into enabled and not
// enabled on Mesita, and the tag catalog — all live tables (MESITA-2891).

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { json, serveJson } from "../_shared/http.ts";
import { requireAdminRequest } from "../_shared/auth.ts";
import {
  fetchGoogleCategories,
  fetchPlaceFamilies,
} from "../_shared/categories.ts";
import { buildFamiliesMap } from "../_shared/families-map.ts";
import { fetchPlaceTags } from "../_shared/tags.ts";

serveJson("admin-web-get-families", async (req) => {
  const ctx = await requireAdminRequest(req, "POST");
  if (ctx instanceof Response) return ctx;
  const { admin } = ctx;

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
