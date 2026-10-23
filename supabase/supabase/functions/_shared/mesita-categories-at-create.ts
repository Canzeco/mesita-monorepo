// Infer Mesita category slugs once at Create (gate d2a). Enrich must not redo
// when mesita_categories is already non-empty.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchPlaceCategories } from "./categories.ts";
import { inferPlaceCategory } from "./categories-infer.ts";
import { humanizeCategorySlug } from "./parse-utils.ts";
import { writePlace } from "./place-doc.ts";

export async function inferMesitaCategoriesAtCreate(
  admin: SupabaseClient,
  placeId: string,
  signals: {
    name: string;
    address?: string | null;
    googlePrimaryType?: string | null;
    googleTypes?: string[];
    editorialSummary?: string | null;
  },
): Promise<{ ok: boolean; slugs: string[] }> {
  const openaiKey = Deno.env.get("OPENAI_KEY")?.trim();
  if (!openaiKey) return { ok: false, slugs: [] };

  const categories = await fetchPlaceCategories(admin);
  const slug = await inferPlaceCategory(openaiKey, categories, {
    name: signals.name,
    address: signals.address,
    googlePrimaryType: signals.googlePrimaryType,
    googleTypes: signals.googleTypes,
    editorialSummary: signals.editorialSummary,
  });
  if (!slug) return { ok: false, slugs: [] };

  const slugs = [slug];
  const written = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: placeId,
    patch: {
      category: slug,
      category_label: humanizeCategorySlug(slug),
      mesita_categories: slugs,
    },
  });
  return { ok: written.ok, slugs };
}

export function mesitaCategoriesLocked(row: Record<string, unknown>): boolean {
  const raw = row.mesita_categories;
  if (!Array.isArray(raw)) return false;
  return raw.some((v) => typeof v === "string" && v.trim().length > 0);
}
