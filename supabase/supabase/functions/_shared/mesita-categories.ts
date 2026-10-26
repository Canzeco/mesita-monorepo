// Mesita categories (MESITA-2790): 1–3 place_categories slugs, main first,
// inferred at Create and again on every Enrich. Read-only to operators; the
// profiles view derives families from them. Written only on success — a
// failed call or no valid slug leaves the stored categories unchanged.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchPlaceCategories } from "./categories.ts";
import { inferPlaceCategories } from "./categories-infer.ts";
import { humanizeCategorySlug } from "./parse-utils.ts";
import { writePlace } from "./place-doc.ts";

/** The columns one successful inference writes together. */
export function mesitaCategoriesPatch(slugs: string[]): Record<string, unknown> {
  return {
    mesita_categories: slugs,
    category: slugs[0],
    category_label: humanizeCategorySlug(slugs[0]),
  };
}

/** Create's call: infer, then write the three columns in one update. */
export async function inferMesitaCategories(
  admin: SupabaseClient,
  placeId: string,
  signals: {
    name: string;
    address?: string | null;
    googleTypes?: string[];
    googleTags?: string[];
    editorialSummary?: string | null;
  },
): Promise<{ ok: boolean; slugs: string[] }> {
  const openaiKey = Deno.env.get("OPENAI_KEY")?.trim();
  if (!openaiKey) return { ok: false, slugs: [] };

  const categories = await fetchPlaceCategories(admin);
  const slugs = await inferPlaceCategories(openaiKey, categories, signals);
  if (!slugs) return { ok: false, slugs: [] };

  const written = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: placeId,
    patch: mesitaCategoriesPatch(slugs),
  });
  return { ok: written.ok, slugs };
}
