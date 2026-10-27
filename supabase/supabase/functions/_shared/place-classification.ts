// Google categories (MESITA-2827): 1–3 of Google's canonical list, the shown
// one first, inferred by one call on Create and on every Enrich. Written only
// on success — a failed call or no valid slug leaves the stored list unchanged.
//
// Families are not inferred here or anywhere (MESITA-2834, Pato: "directly
// infered with dictionary based on canonic google categories"): the profiles
// view maps the Google categories through catalog_membership
// (place_family_keys → families_for_categories), so a place's families
// follow its categories and nothing writes family_keys.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { fetchGoogleCategories, type PlaceCategory } from "./categories.ts";
import { inferPlaceCategories } from "./categories-infer.ts";
import { humanizeCategorySlug } from "./parse-utils.ts";
import { writePlace } from "./place-doc.ts";

/** The columns one successful categories call writes together. */
export function googleCategoriesPatch(slugs: string[]): Record<string, unknown> {
  return {
    google_types: slugs,
    category: slugs[0],
    category_label: humanizeCategorySlug(slugs[0]),
  };
}

export type ClassificationSignals = {
  name: string;
  address?: string | null;
  /** Google's own types (google_source_types), primary first. */
  googleTypes?: string[];
  googleTags?: string[];
  editorialSummary?: string | null;
  description?: string | null;
};

export type Classification = {
  /** 1–3 Google categories, or null when the call failed. */
  categories: string[] | null;
};

/** The categories call. The vocabulary is passed in so a run reads the
 *  table once. */
export async function classifyPlace(
  openaiKey: string | undefined,
  vocab: { categories: PlaceCategory[] },
  signals: ClassificationSignals,
  model?: string,
): Promise<Classification> {
  const categories = await inferPlaceCategories(openaiKey, vocab.categories, signals, model);
  return { categories };
}

/** What a classification adds to a patch: only the list that came back. */
export function classificationPatch(c: Classification): Record<string, unknown> {
  return c.categories && c.categories.length > 0 ? googleCategoriesPatch(c.categories) : {};
}

/** Create's call: classify, then write what came back in one update. */
export async function classifyAndWritePlace(
  admin: SupabaseClient,
  placeId: string,
  signals: ClassificationSignals,
): Promise<{ ok: boolean } & Classification> {
  const openaiKey = Deno.env.get("OPENAI_KEY")?.trim();
  if (!openaiKey) return { ok: false, categories: null };

  const categories = await fetchGoogleCategories(admin);
  const result = await classifyPlace(openaiKey, { categories }, signals);
  const patch = classificationPatch(result);
  if (Object.keys(patch).length === 0) return { ok: false, ...result };

  const written = await writePlace(admin, {
    table: "place_profiles",
    mode: "update",
    id: placeId,
    patch,
  });
  return { ok: written.ok, ...result };
}
