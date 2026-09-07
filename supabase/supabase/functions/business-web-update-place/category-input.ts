import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  inferPlaceCategory,
  type PlaceCategory,
} from "../_shared/categories.ts";
import {
  familiesForAtlasCategory,
  sanitizeFamilyKeys,
} from "../_shared/place-taxonomy.ts";
import { optString } from "./project-update-utils.ts";

function familyKeysForCategory(hit: PlaceCategory): string[] | null {
  const live = sanitizeFamilyKeys(hit.super_category_slugs);
  const keys = live.length > 0 ? live : familiesForAtlasCategory(hit.slug);
  return keys.length > 0 ? keys : null;
}

export async function resolveCategoryInput(
  admin: SupabaseClient,
  input: unknown,
  openaiKey: string | undefined,
): Promise<
  | { ok: true; slug: string | null; label: string | null; familyKeys: string[] | null }
  | { ok: false; error: string }
> {
  const raw = optString(input, 120);
  if (raw == null) {
    return { ok: true, slug: null, label: null, familyKeys: null };
  }
  const { data, error } = await admin
    .from("place_categories")
    .select("slug, label, super_category_slugs");
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
      label: hit.label,
      familyKeys: familyKeysForCategory(hit),
    };
  }

  // NLP fallback: map free-form/Google category text to the closest Mesita
  // category slug instead of requiring exact text equality.
  const inferredSlug = await inferPlaceCategory(openaiKey, categories, {
    name: raw,
    googlePrimaryType: raw,
    googlePrimaryTypeDisplay: raw,
  });
  if (inferredSlug) {
    const inferredHit = categories.find((c) => c.slug === inferredSlug);
    if (inferredHit) {
      return {
        ok: true,
        slug: inferredHit.slug,
        label: inferredHit.label,
        familyKeys: familyKeysForCategory(inferredHit),
      };
    }
  }

  return {
    ok: false,
    error:
      "category could not be mapped to a Mesita category. Try a clearer category name.",
  };
}
