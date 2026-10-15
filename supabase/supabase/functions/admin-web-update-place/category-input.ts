import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import type { PlaceCategory } from "../_shared/categories.ts";
import { googleCategoryDisplay } from "../_shared/google-categories.ts";
import { optString } from "./place-update-utils.ts";

export async function resolveCategoryInput(
  admin: SupabaseClient,
  input: unknown,
  _openaiKey: string | undefined,
): Promise<
  | { ok: true; slug: string | null; label: string | null }
  | { ok: false; error: string }
> {
  const raw = optString(input, 120);
  if (raw == null) {
    return { ok: true, slug: null, label: null };
  }
  const { data, error } = await admin
    .from("place_categories")
    .select("slug, label, emoji");
  if (error) {
    return { ok: false, error: `category_lookup: ${error.message}` };
  }
  const categories = (data ?? []) as PlaceCategory[];
  const needle = raw.trim().toLowerCase();
  const hit = categories.find(
    (c) => c.slug.toLowerCase() === needle || c.label.toLowerCase() === needle,
  );
  if (hit) {
    return {
      ok: true,
      slug: hit.slug,
      label: googleCategoryDisplay(hit.slug) ?? hit.label,
    };
  }

  return {
    ok: false,
    error: "category must be one of Google's categories.",
  };
}
