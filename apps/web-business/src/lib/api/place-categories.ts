import type { SupabaseClient } from "@supabase/supabase-js";
import { invokeEF, logSwallowedEFError } from "./_invoke";

export type PlaceCategoryOption = {
  slug: string;
  label: string;
  section: string;
  sort_order: number;
  /** 1–2 Atlas Super Category parents (multi-parent law). */
  super_category_slugs?: string[];
};

export type PlaceSuperCategoryOption = {
  slug: string;
  label: string;
  emoji: string;
  sort_order: number;
};

type ListPlaceCategoriesResult = {
  categories: PlaceCategoryOption[];
  superCategories?: PlaceSuperCategoryOption[];
};

export type PlaceCategoryCatalog = {
  categories: PlaceCategoryOption[];
  superCategories: PlaceSuperCategoryOption[];
};

// Fetches the category catalog. Graceful posture (MESITA-28, shared with
// apiListPlaceTags): degrades to an empty array on any error so a transient
// EF/network failure leaves the selector empty rather than crashing the place
// form — but the failure is always logged, never silent.
export async function apiListPlaceCategories(
  client: SupabaseClient,
): Promise<PlaceCategoryOption[]> {
  const catalog = await apiListPlaceCategoryCatalog(client);
  return catalog.categories;
}

// Categories + Super Category vocabulary in one call (same EF). Graceful:
// both arrays degrade to empty on any error, logged, never a crash.
export async function apiListPlaceCategoryCatalog(
  client: SupabaseClient,
): Promise<PlaceCategoryCatalog> {
  try {
    const data = await invokeEF<ListPlaceCategoriesResult>(
      client,
      "business-web-list-categories",
      {},
    );
    return {
      categories: data.categories ?? [],
      superCategories: data.superCategories ?? [],
    };
  } catch (err) {
    logSwallowedEFError(err);
    return { categories: [], superCategories: [] };
  }
}
