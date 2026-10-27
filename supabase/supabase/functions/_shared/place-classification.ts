// Google categories and Families (MESITA-2827): two independent lists, each
// inferred by its own call on Create and on every Enrich. The categories run
// first (1–3 of Google's canonical list, the shown one first); the families
// call (1–5) reads them as a hint. Each is written only on success — a failed
// call or no valid slug leaves the stored list unchanged.

import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";
import {
  fetchGoogleCategories,
  fetchPlaceFamilies,
  type PlaceCategory,
  type PlaceFamily,
} from "./categories.ts";
import { inferPlaceCategories } from "./categories-infer.ts";
import { inferPlaceFamilies } from "./families-infer.ts";
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

/** The families the Google categories map to (catalog_membership), as a hint. */
export function mappedFamilies(slugs: string[], categories: PlaceCategory[]): string[] {
  const bySlug = new Map(categories.map((c) => [c.slug, c.family_keys ?? []] as const));
  const out: string[] = [];
  for (const slug of slugs) {
    for (const key of bySlug.get(slug) ?? []) {
      if (key !== "undefined" && !out.includes(key)) out.push(key);
    }
  }
  return out;
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
  /** 1–5 families, or null when the call failed. */
  families: string[] | null;
};

/** Both calls, categories first. The vocabularies are passed in so a run
 *  reads each table once. */
export async function classifyPlace(
  openaiKey: string | undefined,
  vocab: { categories: PlaceCategory[]; families: PlaceFamily[] },
  signals: ClassificationSignals,
  model?: string,
): Promise<Classification> {
  const categories = await inferPlaceCategories(openaiKey, vocab.categories, signals, model);
  const shown = categories ?? signals.googleTypes ?? [];
  const families = await inferPlaceFamilies(openaiKey, vocab.families, {
    name: signals.name,
    address: signals.address,
    googleCategories: shown,
    mappedFamilies: mappedFamilies(shown, vocab.categories),
    googleTags: signals.googleTags,
    editorialSummary: signals.editorialSummary,
    description: signals.description,
  }, model);
  return { categories, families };
}

/** What a classification adds to a patch: only the lists that came back. */
export function classificationPatch(c: Classification): Record<string, unknown> {
  return {
    ...(c.categories && c.categories.length > 0 ? googleCategoriesPatch(c.categories) : {}),
    ...(c.families && c.families.length > 0 ? { family_keys: c.families } : {}),
  };
}

/** Create's call: classify, then write what came back in one update. */
export async function classifyAndWritePlace(
  admin: SupabaseClient,
  placeId: string,
  signals: ClassificationSignals,
): Promise<{ ok: boolean } & Classification> {
  const openaiKey = Deno.env.get("OPENAI_KEY")?.trim();
  if (!openaiKey) return { ok: false, categories: null, families: null };

  const [categories, families] = await Promise.all([
    fetchGoogleCategories(admin),
    fetchPlaceFamilies(admin),
  ]);
  const result = await classifyPlace(openaiKey, { categories, families }, signals);
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
